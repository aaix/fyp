from shared.py.misc import MultiRuntimeLock
import asyncio, threading
import time


_print = print
_print_lock = threading.Lock()
def print(*args, **kwargs):
    with _print_lock:
        _print(*args, **kwargs)

lock = MultiRuntimeLock()

blocked = False
spawned = []
completed = []

SLEEP_DUR = 0.2

async def watchdog():
    before = time.monotonic()
    t = threading.current_thread().name
    while True:
        after = time.monotonic()
        if after - before > 0.05:
            print(f"{t} WAS BLOCKED FOR {after - before}")
            global blocked
            blocked = True
        before = after
        await asyncio.sleep(0)




async def async_work(task):
    current = threading.current_thread().name
    async with lock:
        print(f"{current} task {task} owns lock", flush=True)
        await asyncio.sleep(SLEEP_DUR)


def sync_work():
    loop = asyncio.new_event_loop()
    tasks = []
    loop.create_task(watchdog())

    for i in range(5):
        task = loop.create_task(async_work(i))
        tasks.append(task)
        spawned.append(task)
        task.add_done_callback(lambda t: completed.append(t) if not t.exception() else None)
    loop.run_until_complete(asyncio.gather(*tasks))


threads = []
started = time.monotonic()
for _ in range(10):
    thread = threading.Thread(target=sync_work)
    threads.append(thread)
    thread.start()

for thread in threads:
    thread.join()

assert not blocked, "A THREAD BLOCKED"
assert len(spawned) == len(completed)
assert time.monotonic() - started >= (len(spawned) * SLEEP_DUR)




