from typing import Final, Iterable

import uuid
from uuid import UUID
import asyncio

from grpc import RpcError, StatusCode
from pydantic import TypeAdapter, ValidationError
from websockets import CloseCode, ConnectionClosed, ServerConnection

from gateway.models import events
import gateway.server
from gateway.models.events import Event_t
from gateway.models.closecodes import GatewayCloseCode
from gateway.models.exceptions import HandshakeFailed
from gateway.models.internalevent import InternalEvent
from gateway.models.messages import BaseMessage, ClientAuth, ClientHello, ClientMessage_T, EventMessage, NewDeviceClientHello, ServerHello, SessionComplete



from shared.py.discovery import DiscoveryManager
from shared.py.grpc.device import read_devices, find_device_by_id
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.user import get_user
from shared.py.grpcgen import user_pb2_grpc
from shared.py.crypto import challenge

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
        self.last_acked: int = 0


        self.cleanup_lock = asyncio.Lock()
        self.cleaned_up: bool = False


        # init after handshake
        self.user_id: UUID | None = None
    
    def __repr__(self) -> str:
        return f"<GatewayClient {self.user_id=} {self.id=}>"
    
    def __hash__(self) -> int:
        return hash(self.id)
    
    async def send_event(self, event: Event_t):
        await self.send(EventMessage(
            op="event",
            d=event
        ))

    async def send(self, msg: BaseMessage):
        self.server_seq += 1
        msg.seq = self.server_seq

        data = msg.model_dump_json()
        await self.ws.send(data, text=True)
    
    async def shutdown(self):
        await self.close(CloseCode.GOING_AWAY, "node shutting down")


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
            except ConnectionClosed, asyncio.QueueShutDown:
                return # safe error so just cleanup and leave
            finally:
                await self.cleanup()


    async def handle_internal(self, e: InternalEvent):
        return

    async def handle_incoming(self, d: bytes):
        try:
            clientmessage = TypeAdapter(ClientMessage_T).validate_json(d)
        except ValidationError as e:
            await self.send_event(events.HintEvent(message=e.errors(include_url=False, include_input=False)))
            await self.close(GatewayCloseCode.MALFORMED_DATA, "could not determine clientmessage type")

    
    async def handle_close(self, exc: ConnectionClosed):
        self.open = False
        if exc.sent:
            # we closed so we dont need to handle anything
            return
        if not (rcv := exc.rcvd):
            return
    

    async def close(self, code: int, reason: str) -> None:
        await self.ws.close(code=code, reason=reason)
        await self.cleanup()

    async def cleanup(self) -> None:
        async with self.cleanup_lock:
            if self.cleaned_up:
                return
            self.cleaned_up = True

        self.queue.shutdown()
        await self.controller.unregister(self)



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
        raise HandshakeFailed(HandshakeFailed.Reason.BAD_PAYLOAD, msg)


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
    
    async def new_device_handshake(self, clienthello: NewDeviceClientHello):
        raise NotImplementedError()

    async def regular_handshake(self, clienthello: ClientHello) -> UUID:

        user_id = clienthello.user_id
        device_id = clienthello.device_id

        try:
            # read device and user from grpc concurrently
            devices, user = await asyncio.gather(
                read_devices(grpcdevice, user_id),
                get_user(grpcuser, user_id)
            )
        except RpcError as e:
            if e.code != StatusCode.NOT_FOUND:
                raise
            raise HandshakeFailed(HandshakeFailed.Reason.BAD_PAYLOAD, "user not found") from e

        if not (device := find_device_by_id(devices, device_id)):
            raise HandshakeFailed(HandshakeFailed.Reason.BAD_PAYLOAD, "device not found")
        
        device_challenge = challenge.create_challenge(device.device_public_key)
        account_challenge = challenge.create_challenge(user.public_key)

        serverhello = ServerHello(
            op="server_hello",
            device_challenge=device_challenge.ciphertext,
            account_challenge=account_challenge.ciphertext,
        )
        await self.send(serverhello)
        clientauth = await self.handshake_get_next(ClientAuth)

        account_solved = challenge.verify_challenge(
            clientauth.solved_device_challenge,
            device_challenge
        )
        device_solved = challenge.verify_challenge(
            clientauth.solved_account_challenge,
            account_challenge
        )

        if not (device_solved and account_solved):
            raise HandshakeFailed(HandshakeFailed.Reason.BAD_AUTH, "Incorrect challenge")


        sessioncomplete = SessionComplete(
            op="session_complete"
        )
        await self.send(sessioncomplete)

        self.user_id = user_id
        self.handshake_complete = True
        return user_id

        

