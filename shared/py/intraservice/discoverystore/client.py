import asyncio
from typing import Any, cast
from uuid import UUID

from glide import GlideClusterClientConfiguration, NodeAddress, GlideClusterClient, PubSubMsg
from uhashring import HashRing

from shared.py.intraservice.discoverystore import BigPictureService
from shared.py.discovery import DiscoveryManager
from shared.py.types import SingletonMixin


discovery = DiscoveryManager()

class BigPictureClient(SingletonMixin):
    """Uses a hash ring to build a consistent big picture of the distributed system"""
    
    def __init__(self, service: BigPictureService):
        address = discovery.discover_valkey()
        self.valkey_addresses = [NodeAddress(*address),]
        self.sub_patterns = {service.join_channel, service.leave_channel}
        self.member_set = service.state_set
        self.ring_built = asyncio.Event()
        
        self.ring = HashRing() # TODO: this is NOT thread safe (relies on GIL)
    

    async def valkey_connect(self) -> None:
        config = GlideClusterClientConfiguration(
            self.valkey_addresses,
            request_timeout=500,
            pubsub_subscriptions=GlideClusterClientConfiguration.PubSubSubscriptions(
                channels_and_patterns={
                    GlideClusterClientConfiguration.PubSubChannelModes.Pattern: self.sub_patterns
                },
                callback=self.on_message,
                context=None,
            )
        )
        self.store = await GlideClusterClient.create(config)
        members = await self.store.smembers(self.member_set)
        for node in members:
            self.ring.add_node(node.decode())
        self.ring_built.set()
        print(f"BigPictureClient({self.member_set}): built ring of size {len(self.ring.get_nodes())}", flush=True)


    def on_message(self, msg: PubSubMsg, _context: Any):

        data = msg.message.decode() if isinstance(msg.message, bytes) else msg.message

        match msg.channel:
            case "gateway.join":
                self.ring.add_node(data)
            case "gateway.leave":
                self.ring.remove_node(data)
    
    async def get_node(self, key_id: UUID) -> str:
        """Get the corresponding node for a uuid"""
        await self.ring_built.wait()

        key = key_id.bytes

        return cast(str, self.ring.get_node(key))
            


