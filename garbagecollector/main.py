import signal
from typing import Any

from collections.abc import Callable, Coroutine, Sequence


import argparse
import asyncio
import sys
import threading

from garbagecollector.tracing import tracer
from garbagecollector import processors

from shared.py.grpc.gc import GarbageFlags, GarbageType, read_gc
from shared.py.grpc.id import MIN_UUID_V1, id_t, id_uuid
from shared.py.grpc.lazy import DataservicesLazyGRPC, lazy_init
from shared.py.grpcgen import gc_pb2_grpc
from shared.py.grpcgen.gc_pb2 import GarbageItem

CONF_GC_SIZE = 100
CONF_MAX_CONCURRENT_TASKS = 100
CONF_MAX_WAITING_TASKS = 20


def process_args() -> range:
    parser = argparse.ArgumentParser()
    parser.add_argument("--buckets", type=calculate_range_from_arg)

    args = parser.parse_args(sys.argv[1:])
    return args.buckets


def calculate_range_from_arg(arg: str) -> range:
    l, r = arg.split("-", 2)
    return range(int(l), int(r) + 1)

async def find_garbage_to_collect(grpcgarbage: DataservicesLazyGRPC[gc_pb2_grpc.GarbageServiceStub], bucket: int, after: id_t) -> Sequence[GarbageItem]:
    rpc = await read_gc(grpcgarbage, bucket, after, CONF_GC_SIZE)
    return rpc.for_collection


async def drain_queue[T](queue: asyncio.Queue[T], semaphore: asyncio.Semaphore, processor: Callable[[T], Coroutine[Any, Any, None]]):
    while True:
        await semaphore.acquire()
        item = await queue.get()
        task = asyncio.create_task(processor(item))
        task.add_done_callback(lambda _: semaphore.release)

async def process_garbage(garbage: GarbageItem):
    with tracer.start_as_current_span("process_garbage") as span:
        span.set_attribute("az.garbagecollector.object_id", str(id_uuid(garbage.object_id)))
        flags = GarbageFlags(garbage.garbage_flags)
        match GarbageType(garbage.garbage_type):
            case GarbageType.CHANNEL:
                await processors.process_channel(bucket, garbage.object_id, flags)
            case GarbageType.POST:
                await processors.process_post(bucket, garbage.object_id, flags)


async def gc_loop(bucket: int, shutdown: threading.Event):
    await lazy_init()
    print(f"Starting processing on bucket {bucket}")

    grpcgarbage = DataservicesLazyGRPC(gc_pb2_grpc.GarbageServiceStub)


    queue: asyncio.Queue[GarbageItem]  = asyncio.Queue(CONF_MAX_WAITING_TASKS)
    semaphore = asyncio.Semaphore(CONF_MAX_CONCURRENT_TASKS)

    drainer = asyncio.create_task(drain_queue(queue, semaphore, process_garbage))

    after = MIN_UUID_V1

    while True:
        if shutdown.is_set():
            drainer.cancel()
            print(f"[{bucket}] Cancelled drainer")
            return

        with tracer.start_as_current_span("do_gc_loop") as span:
            span.set_attribute("az.garbagecollector.bucket", str(bucket))
            to_collect = await find_garbage_to_collect(grpcgarbage, bucket, after)
            if len(to_collect) == 0:
                with tracer.start_as_current_span("gc_wait"):
                    await asyncio.sleep(120)
                continue

            after = to_collect[-1].object_id
            
            for garbage in to_collect:
                await queue.put(garbage)

def run_gc_thread(shutdown: threading.Event, bucket: int):
    loop = asyncio.new_event_loop()
    loop.run_until_complete(gc_loop(bucket, shutdown))


if __name__ == "__main__":
    shutdown = threading.Event()

    signal.signal(signal.SIGTERM, lambda *_: shutdown.set())
    signal.signal(signal.SIGINT, lambda *_: shutdown.set())

    threads = []

    for bucket in process_args():
        # TODO: only 1 worker is usable until aio grpc is thread safe
        thread = threading.Thread(target=lambda: run_gc_thread(shutdown, bucket))
        thread.start()
        threads.append(thread)
    
    for thread in threads:
        thread.join() # join so the interpereter is not trying to shutdown

