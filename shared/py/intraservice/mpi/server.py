from typing import Self


import asyncio

from shared.py.intraservice.mpi import MPI_PORT, MPI_MAX_SIZE
from shared.py.intraservice.mpi.sock import AsyncRecvSocket


class Sub:
    def __init__(self, loop: asyncio.AbstractEventLoop, port: int = MPI_PORT):
        self.loop = loop
        self.wrap = AsyncRecvSocket("0.0.0.0", port, loop)
    
    async def test_bind(self):
        async with self.wrap: ...
    
    async def recv_once(self) -> bytes:
        async with self.wrap as s:
            return await self.loop.sock_recv(s, MPI_MAX_SIZE)
    
    async def close(self):
        self.wrap.close()
    
    async def __aenter__(self):
        await self.wrap.__aenter__()
    
    def __aiter__(self) -> Self:
        if not self.wrap.in_context:
            raise RuntimeError("Iter should only be called from inside an async context manager")
        return self

    async def __anext__(self) -> bytes:
        return await self.loop.sock_recv(self.wrap.sock, MPI_MAX_SIZE)
    
    async def __aexit__(self, exc_type, exc, tb):
        await self.wrap.__aexit__(exc_type, exc, tb)