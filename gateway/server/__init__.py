from typing import Any

import asyncio
from asyncio import AbstractEventLoop, Future, Task
from collections import defaultdict
from uuid import UUID

from websockets import CloseCode, ConnectionClosed, ServerConnection

from gateway import log
from gateway.client import GatewayClient
from gateway.models.closecodes import GatewayCloseCode
from gateway.models.exceptions import HandshakeFailed


class GatewayController:
    def __init__(self):
        self.pending: dict[UUID, GatewayClient] = {}
        self.by_user: defaultdict[UUID, set[GatewayClient]] = defaultdict(set)
    
    def shutdown(self, loop: AbstractEventLoop, server_future: Future[None]):
        server_future.set_result(None)
        loop.create_task(self.shutdown_inner(loop))
    
    async def shutdown_inner(self, loop: AbstractEventLoop):
        existing: list[Task[Any]] = []
        pending: list[Task[Any]] = []
        for clients in self.by_user.values():
            for client in clients:
                existing.append(loop.create_task(client.shutdown()))
        for client in self.pending.values():
            pending.append(loop.create_task(client.shutdown()))
        
        log(f"Shutting down {len(existing)=} {len(pending)=}")

        await asyncio.gather(*existing, *pending, return_exceptions=True)
        log(f"Shut down all clients")


    async def accept_incoming(self, ws: ServerConnection) -> None:
        client = GatewayClient(self, ws)
        self.pending[client.id] = client

        try:
            user_id = await client.handshake()
        except HandshakeFailed as failure:
            log(f"Client {client.id} failed handshake due to {failure.reason.name}: {failure.message}")
            await client.close(GatewayCloseCode.HANDSHAKE_FAILED, failure.message)
            return
        except ConnectionClosed:
            return await client.close(CloseCode.GOING_AWAY, "closed during handshake")
        finally:
            self.pending.pop(client.id)

        self.by_user[user_id].add(client)

        await client.loop()

            

    async def unregister(self, client: GatewayClient):
        self.pending.pop(client.id, None)

        if not client.user_id:
            return

        self.by_user[client.user_id].discard(client)

        # delete set if empty
        if not len(self.by_user[client.user_id]):
            self.by_user.pop(client.user_id, None)

