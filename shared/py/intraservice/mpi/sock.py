import traceback
from typing import Any, Literal

import socket
import asyncio


class AsyncSocket:
    """Asynchronous socket abstraction, ensures socket has had any async setup before use (via context manager)"""
    def __init__(self, loop: asyncio.AbstractEventLoop, af: socket.AddressFamily, kind: socket.SocketKind):
        self.loop = loop

        s = socket.socket(af, kind)
        # asyncio requires non blocking sockets
        s.setblocking(False)

        self.sock = s

        # coroutine safe is required as connect is across an async boundary
        self.__connected_lock = asyncio.Lock()
        self.__connected = False

    async def __aenter__(self) -> socket.socket:
        self.in_context = True
        # short circuit without lock
        if self.__connected:
            return self.sock
        
        # take lock to setup
        async with self.__connected_lock:
            if self.__connected:
                # someone took the lock between us checking __connected and taking the lock
                return self.sock
            await self.connect()
            self.__connected = True

        return self.sock
    
    async def connect(self):
        raise NotImplementedError

    
    async def __aexit__(self, exc_type: type[Exception], exc: Exception, _tb: Any) -> bool:
        self.in_context = False
        return False
        
    def close(self) -> None:
        self.sock.close()

class AsyncSendSocket(AsyncSocket):
    """Asynchronous setup ensured sender socket"""
    def __init__(self,  remote: str, port: int, loop: asyncio.AbstractEventLoop):
        super().__init__(loop, socket.AF_INET, socket.SOCK_DGRAM)
        self.__remote = remote
        self.__port = port
        self.sent = 0
        self.refused = 1
    
    async def connect(self):
        await self.loop.sock_connect(self.sock, (self.__remote, self.__port))
    

    async def __aexit__(self, exc_type: type[Exception], exc: Exception, _tb: Any) -> bool:
        """Sending may recieve ICMP dest unreachable messages so msut be ignored"""
        await super().__aexit__(exc_type, exc, _tb)
        if exc_type is ConnectionRefusedError:
            self.refused += 1
            return True
        elif exc_type is None:
            self.sent += 1
        return False

class AsyncRecvSocket(AsyncSocket):
    """Asynchronous setup ensured receiver socket"""
    def __init__(self,  bind_addr: str, port: int, loop: asyncio.AbstractEventLoop):
        super().__init__(loop, socket.AF_INET, socket.SOCK_DGRAM)
        self.__bind_addr = bind_addr
        self.__port = port
    
    async def connect(self):
        self.sock.bind((self.__bind_addr, self.__port))
    
    async def __aexit__(self, exc_type: type[Exception], exc: Exception, _tb: Any) -> Literal[False]:
        """Exceptions are for the parent to handle, so we type that we never handle any"""
        await super().__aexit__(exc_type, exc, _tb)
        return False
        
    
       