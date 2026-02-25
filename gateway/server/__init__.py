from asyncio import AbstractEventLoop, Future
from collections import defaultdict
from uuid import UUID

from websockets import ServerConnection

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
        existing = 0
        pending = 0
        for clients in self.by_user.values():
            for client in clients:
                loop.create_task(client.shutdown())
                existing += 1
        for client in self.pending.values():
            loop.create_task(client.shutdown())
            pending += 1
        
        print(f"Shutting down {existing=} {pending=}", flush=True)
        

    async def accept_incoming(self, ws: ServerConnection):
        client = GatewayClient(self, ws)
        self.pending[client.id] = client

        try:
            user_id = await client.handshake()
        except HandshakeFailed as failure:
            print(f"Client {client.id} failed handshake due to {failure.reason.name}: {failure.message}")
            await client.close(GatewayCloseCode.HANDSHAKE_FAILED, failure.message)
            return
        finally:
            self.pending.pop(client.id)
        self.by_user[user_id].add(client)

        await client.loop()

    async def unregister(self, client: GatewayClient):
        self.pending.pop(client.id, None)
        self.by_user[client.id].discard(client)

        # delete set if empty
        if len(self.by_user[client.id]):
            self.by_user.pop(client.id, None)

