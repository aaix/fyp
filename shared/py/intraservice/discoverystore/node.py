
from glide import GlideClusterClientConfiguration, NodeAddress, GlideClusterClient

from shared.py.intraservice.discoverystore import BigPictureService
from shared.py.types import SingletonMixin

class BigPictureNode(SingletonMixin):
    """Registers the current node as a node on the big picture"""
    def __init__(self, valkey_address: tuple[str, int], my_address: str, service: BigPictureService):
        self.valkey_addresses = [NodeAddress(*valkey_address),]
        self.my_address = my_address
        self.join_channel = service.join_channel
        self.leave_channel = service.leave_channel
        self.member_set = service.state_set

    async def valkey_connect(self):
        config = GlideClusterClientConfiguration(
            self.valkey_addresses,
            request_timeout=500,
        )
        self.store = await GlideClusterClient.create(config)

        await self.store.sadd(self.member_set, [self.my_address])
        await self.store.publish(self.my_address, self.join_channel)
    
    async def shutdown(self): 
        await self.store.srem(self.member_set, [self.my_address])
        await self.store.publish(self.my_address, self.leave_channel)
