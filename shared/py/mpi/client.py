import asyncio
import socket
from typing import Any, Literal

from shared.py.types import KeyedDefaultDict, SingletonMixin


class AsyncSocket:
    """Asynchronous socket abstraction, ensures socket has connected to remote before use"""
    def __init__(self, remote: str, port: int, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self.remote = remote
        self.port = port
        
        # success tracking
        self.sent = 0
        self.refused = 0

        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # asyncio requires non blocking sockets
        s.setblocking(False)

        self.sock = s

        # coroutine safe is required as connect is across an async boundary
        self.__connected_lock = asyncio.Lock()
        self.__connected = False

    async def __aenter__(self) -> socket.socket:
        # short circuit without lock
        if self.__connected:
            return self.sock
        
        # take lock to setup
        async with self.__connected_lock:
            if self.__connected:
                # someone took the lock between us checking __connected and taking the lock
                return self.sock

            print(f"Connecting to peer {self.remote}:{self.port}", flush=True)
            await self.loop.sock_connect(self.sock, (self.remote, self.port))

        return self.sock
    
    async def __aexit__(self, exc_type: type[Exception], exc: Exception, _tb: Any) -> bool:
        if exc_type is ConnectionRefusedError:
            self.refused += 1
            return True
        elif exc_type is None:
            self.sent += 1

        return False
        

    def close(self) -> None:
        print(f"Closing socket to peer {self.remote}:{self.port}", flush=True)
        self.sock.close()



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

    def peer_factory(self, remote: str, port=3117):
        return AsyncSocket(remote, port, self.loop)

    def remove_socket(self, remote: str):
        if remote not in self.peers:
            return
        s = self.peers.pop(remote)
        s.close()
    

    async def send_to(self, remote: str, payload: bytes):
        async with self.peers[remote] as s:
            await self.loop.sock_sendall(s, payload)
    

    


