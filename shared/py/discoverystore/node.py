
from glide import GlideClusterClientConfiguration, NodeAddress, GlideClusterClient

from shared.py.discoverystore import GATEWAY_SET, CHANNEL_GATEWAY_JOIN, CHANNEL_GATEWAY_LEAVE
from shared.py.types import SingletonMixin

class BigPictureNode(SingletonMixin):
    """Registers the current node as a node on the big picture"""
    def __init__(self, valkey_address: tuple[str, int], my_address: str):
        self.valkey_addresses = [NodeAddress(*valkey_address),]
        self.my_address = my_address

    async def valkey_connect(self):
        config = GlideClusterClientConfiguration(
            self.valkey_addresses,
            request_timeout=500,
        )
        self.store = await GlideClusterClient.create(config)

        await self.store.sadd(GATEWAY_SET, [self.my_address])
        await self.store.publish(self.my_address, CHANNEL_GATEWAY_JOIN)
    
    async def shutdown(self): 
        await self.store.srem(GATEWAY_SET, [self.my_address])
        await self.store.publish(self.my_address, CHANNEL_GATEWAY_LEAVE)
