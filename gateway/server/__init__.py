from typing import Any

import asyncio
from asyncio import AbstractEventLoop, Future, InvalidStateError, Task
from collections import defaultdict
from uuid import UUID, uuid4

from websockets import CloseCode, ConnectionClosed, ServerConnection

from gateway import log
from gateway.client import GatewayClient
from gateway.models.closecodes import GatewayCloseCode
from gateway.models.exceptions import HandshakeFailed
from gateway.models.messages import NewDeviceClientHello, NewDeviceOK
from gateway.tracing import tracer
from gateway.utils import get_current_node_ip
from shared.py.discoverystore.manager import DiscoveryManager
from shared.py.discoverystore.node import BigPictureNode
from shared.py.mpi.server import Sub


discovery = DiscoveryManager()

class GatewayController:
    def __init__(self, loop: AbstractEventLoop):
        self.id = uuid4()
        self.__loop = loop

        # clients
        self.__pending: dict[UUID, GatewayClient] = {}
        self.__by_user: defaultdict[UUID, set[GatewayClient]] = defaultdict(set)

        # client waiters
        self.__new_device_waiters: dict[tuple[UUID, int], tuple[NewDeviceClientHello, Future[NewDeviceOK]]] = {}

        # distributed system
        self.__address = get_current_node_ip()
        self.__big_picture = BigPictureNode(discovery.discover_valkey(), self.__address)
        self.__sublisher = Sub(self.__loop)
    
    async def start(self):
        await self.__big_picture.valkey_connect()
        await self.__sublisher.test_bind()
        self.__loop.create_task(self.internal_events_loop())

    def shutdown(self, server_future: Future[None]):
        server_future.set_result(None)
        self.__loop.create_task(self.shutdown_inner())
    
    @tracer.start_as_current_span("Controller.shutdown_inner")
    async def shutdown_inner(self):
        await self.__big_picture.shutdown()
        await self.__sublisher.close()

        existing: list[Task[Any]] = []
        pending: list[Task[Any]] = []
        for clients in self.__by_user.values():
            for client in clients:
                existing.append(self.__loop.create_task(client.shutdown()))
        for client in self.__pending.values():
            pending.append(self.__loop.create_task(client.shutdown()))


        exc = HandshakeFailed(HandshakeFailed.Reason.GOING_AWAY, "node shutting down")
        futures_cancelled = 0
        for (_, future)  in self.__new_device_waiters.values():
            try:
                future.set_exception(exc)
            except InvalidStateError:
                continue
            futures_cancelled += 1
        
        log(f"Shutting down {len(existing)=} {len(pending)=}, cancelled {futures_cancelled} handshake waiters")

        await asyncio.gather(*existing, *pending, return_exceptions=True)
        log(f"Shut down all clients")


    async def internal_events_loop(self):
        """Loop through events recieved from the distributed system"""
        async with self.__sublisher:
            async for msg in self.__sublisher:
                log(f"recieved message {msg}")


    # client connection management


    async def accept_incoming(self, ws: ServerConnection) -> None:
        with tracer.start_as_current_span("Controller.accept_incoming"):
            client = GatewayClient(self, ws)
            self.__pending[client.id] = client

            try:
                user_id = await client.handshake()
            except HandshakeFailed as failure:
                log(f"Client {client.id} failed handshake due to {failure.reason.name}: {failure.message}")
                if failure.reason == HandshakeFailed.Reason.BAD_AUTH:
                    code = GatewayCloseCode.UNAUTHORIZED
                else:
                    code = GatewayCloseCode.HANDSHAKE_FAILED
                return await client.close(code, failure.message)
            except ConnectionClosed:
                return await client.close(CloseCode.GOING_AWAY, "closed during handshake")
            finally:
                self.__pending.pop(client.id, None)

            self.__by_user[user_id].add(client)

        # dont put the loop in the trace
        await client.loop()
    
    def get_new_device_waiter(self, user_id: UUID, code: int) -> None | tuple[NewDeviceClientHello, Future[NewDeviceOK]]:
        return self.__new_device_waiters.get((user_id, code))

    @tracer.start_as_current_span("Controller.new_device_waiting")
    async def new_device_waiting(self, request: NewDeviceClientHello, user_id: UUID, code: int, timeout=60) -> NewDeviceOK:
        future = asyncio.Future()
        key = (user_id, code)
        self.__new_device_waiters[key] = (request, future)

        try:
            with tracer.start_as_current_span("wait for future") as span:
                span.set_attribute("az.gateway.new_device_waiting.params", str((user_id, code)))
                return await asyncio.wait_for(future, timeout=timeout)
        finally:
            self.__new_device_waiters.pop(key, None)
            

    async def unregister(self, client: GatewayClient):
        self.__pending.pop(client.id, None)

        if not client.user_id:
            return

        self.__by_user[client.user_id].discard(client)

        # delete set if empty
        if not len(self.__by_user[client.user_id]):
            self.__by_user.pop(client.user_id, None)

