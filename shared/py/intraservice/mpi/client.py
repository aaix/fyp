import asyncio

from shared.py.intraservice.mpi import MPI_PORT
from shared.py.intraservice.mpi.sock import AsyncSendSocket
from shared.py.types import KeyedDefaultDict, SingletonMixin


class Pub(SingletonMixin):
    """
    Handler for publishing to a consumer, peers are cached using socket.connect
    to cache ARP lookups by the OS
    """
    def __init__(self, _loop: asyncio.AbstractEventLoop | None = None):
        if _loop is None:
            self.loop = asyncio.get_event_loop()
        else:
            self.loop = _loop

        self.peers = KeyedDefaultDict(self.peer_factory)

    def peer_factory(self, remote: str, port=MPI_PORT):
        return AsyncSendSocket(remote, port, self.loop)

    def remove_socket(self, remote: str):
        if remote not in self.peers:
            return
        s = self.peers.pop(remote)
        s.close()
    

    async def send_to(self, remote: str, payload: bytes):
        async with self.peers[remote] as s:
            await self.loop.sock_sendall(s, payload)
    

    


