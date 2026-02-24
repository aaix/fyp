from typing import Final, Iterable

import uuid
from uuid import UUID
import asyncio

from pydantic import ValidationError
from websockets import ConnectionClosed, ServerConnection

import gateway.server
from gateway.models.closecodes import GatewayCloseCode
from gateway.models.exceptions import HandshakeFailed
from gateway.models.internalevent import InternalEvent
from gateway.models.messages import BaseMessage, ClientAuth, ClientHello, NewDeviceClientHello, ServerHello, SessionComplete



from shared.py.discovery import DiscoveryManager
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import user_pb2_grpc

discovery = DiscoveryManager()

grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)
grpcdevice = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserDeviceServiceStub)



class GatewayClient:
    def __init__(self, controller: gateway.server.GatewayController, ws: ServerConnection):
        self.id: Final[UUID] = uuid.uuid4()
        self.controller = controller
        self.queue: asyncio.Queue[InternalEvent] = asyncio.Queue()
        self.ws: ServerConnection = ws
        self.open: bool = True
        self.handshake_complete = False
        self.client_seq: int = 0
        self.server_seq: int = 0

        # init after handshake
        self.user_id: UUID | None = None
    
    def __hash__(self) -> int:
        return hash(self.id)
    
    async def send(self, msg: BaseMessage):
        msg.seq = self.server_seq
        self.server_seq += 1

        data = msg.model_dump_json()
        await self.ws.send(data, text=True)
    
    async def shutdown(self): ...


    async def next(self) -> Iterable[InternalEvent | bytes]:
        """Get the next message from the controller queue or client gateway"""
        consumer_task = asyncio.create_task(self.ws.recv(decode=False))
        producer_task = asyncio.create_task(self.queue.get())
        try:
            done, _ = await asyncio.wait(
                (consumer_task, producer_task),
                return_when=asyncio.FIRST_COMPLETED,
            )
        finally:
            consumer_task.cancel()
            producer_task.cancel()
        return tuple(task.result() for task in done)
            
    
    async def run_once(self):
        """Process the next message in the queue (blocks)"""
        for data in await self.next():
            match data:
                case InternalEvent():
                    await self.handle_internal(data)
                case bytes():
                    await self.handle_incoming(data)


    async def loop(self):
        """Runs forever"""
        while self.open:
            try:
                await self.run_once()
            except ConnectionClosed:
                await self.cleanup()


    async def handle_internal(self, e: InternalEvent):
        return

    async def handle_incoming(self, d: bytes):
        return

    
    async def handle_close(self, exc: ConnectionClosed):
        await self.controller.unregister(self)
        self.open = False
        if exc.sent:
            # we closed so we dont need to handle anything
            return
        if not (rcv := exc.rcvd):
            return
    
    

    async def close(self, code: int, reason: str) -> None:
        await self.ws.close(code=code, reason=reason)
        await self.cleanup()

    async def cleanup(self) -> None:...


    async def handshake_get_next[T: BaseMessage](self, schema_or_schemas: Iterable[type[T]] | type[T]) -> T:
        """Get the next message from the client and fail if it is not of type[T]"""
        schemas = schema_or_schemas if isinstance(schema_or_schemas, Iterable) else (schema_or_schemas,)

        # this should not be called post handhshake, use the loop instead
        assert not self.handshake_complete
        # next should never return multiple events anyways
        d, = await self.next()
        # if the handshake is not complete, we should not be registered with the controller
        # therefore we should not be polling any controller events
        assert isinstance(d, bytes)


        for schema in schemas:
            try:
                return schema.model_validate_json(d)
            except ValidationError:
                continue
        
        # if we made it then no model was validated correctly
        msg = f"Expected payload of type: {','.join(schema.__name__ for schema in schemas)}"
        await self.close(GatewayCloseCode.MALFORMED_DATA, reason=msg)
        raise HandshakeFailed(HandshakeFailed.Reason.BAD_PAYLOAD)


    async def handshake(self) -> UUID:
        """Complete the handshake and return the user id"""
        clienthello = await self.handshake_get_next((ClientHello, NewDeviceClientHello))
        match clienthello:
            case ClientHello():
                return await self.regular_handshake(clienthello)
            case NewDeviceClientHello():
                return await self.new_device_handshake(clienthello)
            case _:
                unwrap()

    async def regular_handshake(self, clienthello: ClientHello) -> UUID:
        serverhello = ServerHello(
            op="server_hello",
            device_challenge="test",
            account_challenge="test",
        )
        await self.send(serverhello)
        clientauth = await self.handshake_get_next(ClientAuth)

        sessioncomplete = SessionComplete(
            op="session_complete"
        )
        await self.send(sessioncomplete)

        self.handshake_complete = True

    async def new_device_handshake(self, clienthello: NewDeviceClientHello) -> UUID: ...
        

