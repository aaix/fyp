import asyncio
from collections.abc import Callable
import threading
from typing import Any, cast
from uuid import UUID

from glide import GlideClusterClientConfiguration, NodeAddress, GlideClusterClient, PubSubMsg
from uhashring import HashRing

from shared.py.intraservice.discoverystore import BigPictureService
from shared.py.discovery import DiscoveryManager
from shared.py.types import SingletonMixin


discovery = DiscoveryManager()

class BigPictureClient:
    """Uses a hash ring to build a consistent big picture of the distributed system"""
    SERVICE: BigPictureService
    
    def __init__(self, service: BigPictureService):
        address = discovery.discover_valkey()
        self.valkey_addresses = [NodeAddress(*address),]
        self.join_channel = service.join_channel
        self.leave_channel = service.leave_channel
        self.member_set = service.state_set

        self.ring_built = False
        self.ring_building = False
        self.waiter_lock = threading.Lock()
        
        self.ring = HashRing() # TODO: this is NOT thread safe (relies on GIL)

        self.waiters: list[Callable[[], Any]] = []
    

    async def valkey_connect(self) -> None:
        with self.waiter_lock:
            if self.ring_building:
                return
            self.ring_building = True

        config = GlideClusterClientConfiguration(
            self.valkey_addresses,
            request_timeout=500,
            pubsub_subscriptions=GlideClusterClientConfiguration.PubSubSubscriptions(
                channels_and_patterns={
                    GlideClusterClientConfiguration.PubSubChannelModes.Pattern: {self.join_channel, self.leave_channel}
                },
                callback=self.on_message,
                context=None,
            )
        )
        self.store = await GlideClusterClient.create(config)
        members = await self.store.smembers(self.member_set)
        for node in members:
            self.ring.add_node(node.decode())

        waiters = 0
        with self.waiter_lock:
            self.ring_built = True
            waiters = len(self.waiters)
            for waiter in self.waiters:
                waiter()

        thread_name = threading.current_thread().name

        print(f"BigPictureClient({self.member_set}): built ring of size {len(self.ring.get_nodes())}, notified {waiters} waiters, {thread_name} won the init race", flush=True)


    def on_message(self, msg: PubSubMsg, _context: Any):

        data = msg.message.decode() if isinstance(msg.message, bytes) else msg.message

        channel = msg.channel.decode() if isinstance(msg.channel, bytes) else msg.channel

        match channel:
            case self.join_channel:
                print(f"BigPictureClient({self.member_set}): member {data} joining", flush=True)
                self.ring.add_node(data)
            case self.leave_channel:
                print(f"BigPictureClient({self.member_set}): member {data} leaving", flush=True)
                self.ring.remove_node(data)
            case _: ...
    
    def get_node(self, key_id: UUID) -> str:
        """Get the corresponding node for a uuid, should be called before ring built"""

        if not self.ring_built:
            raise RuntimeError("Ring not built")

        key = key_id.bytes

        return cast(str, self.ring.get_node(key))

    async def wait_for(self) -> None:
        """Wait this event loop until an event loop has populated the ring"""
        thread_name = threading.current_thread().name

        event = asyncio.Event()
        loop = asyncio.get_event_loop()

        setter = lambda: loop.call_soon_threadsafe(event.set)

        with self.waiter_lock:
            if self.ring_built:
                return

            self.waiters.append(setter)
            
        await event.wait()

_by_service: dict[BigPictureService, BigPictureClient] = {}
_by_service_lock = threading.Lock()

def BigPictureClientServiceFactory(service: BigPictureService) -> BigPictureClient:
    with _by_service_lock:
        if client := _by_service.get(service, None):
            return client
        client = BigPictureClient(service)
        _by_service[service] = client
    return client