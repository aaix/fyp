from ipaddress import IPv4Address
from typing import Final, Iterable

import uuid
from uuid import UUID
import asyncio

from grpc import RpcError, StatusCode
from opentelemetry import trace
from opentelemetry.trace import Span
from pydantic import ValidationError
from websockets import CloseCode, ConnectionClosed, ServerConnection

from gateway import log
from gateway.models import events
from gateway.models.messages import BaseMessage
import gateway.server
from gateway.models.events import Event_t
from gateway.models.closecodes import GatewayCloseCode
from gateway.models.exceptions import HandshakeFailed
from gateway.models.internalevent import InternalEvent
from gateway.models.messages import *



from gateway.tracing import tracer
from gateway.utils import unwrap
from shared.py.constraints import USER_MAX_NUM_DEVICES
from shared.py.discovery import DiscoveryManager
from shared.py.grpc.device import create_device, get_device, read_devices
from shared.py.grpc.id import puuid_str, puuid_uuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.relationship import RelationshipType
from shared.py.grpc.user import get_bulk_users, get_user, get_user_by_username
from shared.py.grpcgen import user_pb2_grpc
from shared.py.crypto import challenge, onetimecode
from shared.py.grpcgen import internalmessage_pb2
from shared.py.pydantic.user import UserSearchResponse

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

        self.select_device_lock = asyncio.Lock()
        self.selected_device: None | tuple[NewDeviceClientHello, asyncio.Future[NewDeviceOK]] = None

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

    @tracer.start_as_current_span("Client.send")
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
                    parent = trace.set_span_in_context(data.span)
                    with tracer.start_as_current_span("Client.run_once::InternalEvent", context=parent):
                        await self.handle_internal(data)
                case bytes():
                    await self.handle_incoming(data)


    async def loop(self):
        """Runs forever"""
        try:
            while self.open:
                await self.run_once()
        except ConnectionClosed, asyncio.QueueShutDown:
            return # safe error so just cleanup and leave
        finally:
            with tracer.start_as_current_span("Client.loop:cleanup"):
                await self.cleanup()

    # internal events

    @tracer.start_as_current_span("Client.handle_internal")
    async def handle_internal(self, e: InternalEvent):
        match e.oneof:
            case "session_create":
                await self.handle_internal_session_create(e.payload)
            case "channel_create":
                await self.handle_internal_channel_create(e.payload)
            case "friendship_update":
                await self.handle_internal_friendship_update(e.payload)
    

    @tracer.start_as_current_span("Client.handle_internal::friendship_update")
    async def handle_internal_friendship_update(self, d: internalmessage_pb2.EventFriendshipUpdate):
        event = events.FriendEvent(
            peer_user_id=puuid_uuid(d.peer_id) or unwrap(),
            relationship_type=RelationshipType(d.relationship_type) if d.relationship_type else None
        )
        await self.send_event(event)


    @tracer.start_as_current_span("Client.handle_internal::session_create")
    async def handle_internal_session_create(self, d: internalmessage_pb2.EventSessionCreate):
        ip = str(IPv4Address(d.ipaddress))
        await self.send_event(events.SessionCreateEvent(ip_address=ip))
    

    @tracer.start_as_current_span("Client.handle_internal::channel_create")
    async def handle_internal_channel_create(self, d: internalmessage_pb2.EventChannelCreate):
        event = events.ChannelCreateEvent(
            channel_id=puuid_uuid(d.channel_id) or unwrap(),
            channel_name=d.encrypted_channel_name or None,
            encrypted_channel_key=d.encrypted_channel_key
        )
        await self.send_event(event)
    

    # client (gateway) events

    @tracer.start_as_current_span("Client.handle_incoming")
    async def handle_incoming(self, d: bytes):
        try:
            with tracer.start_as_current_span("ClientMessageAdapter.validate_json"):
                msg = ClientMessageAdapter.validate_json(d)
        except ValidationError as e:
            await self.send_event(events.HintEvent(message=e.errors(include_url=False, include_input=False)))
            await self.close(GatewayCloseCode.MALFORMED_DATA, "could not determine clientmessage type")
            return
        
        match msg:
            case SelectDeviceIntention():
                return await self.handle_select_device_intention(msg)
            case SelectDeviceCancel():
                return await self.handle_select_device_cancel(msg)
            case AddDeviceOK():
                return await self.handle_add_device_ok(msg)
            case UserBulkRequest():
                return await self.handle_user_bulk_request(msg)
            case _:
                await self.send_event(events.HintEvent(message=f"msg type {msg.__class__.__name__} not yet implemented"))

    # New device stuff

    @tracer.start_as_current_span("Client.handle_select_device_cancel")
    async def handle_select_device_cancel(self, _sdc: SelectDeviceCancel):
        """Refer to new device gateway handshake diagram"""
        self.selected_device = None
        try:
            self.select_device_lock.release()
        except RuntimeError:
            pass

    @tracer.start_as_current_span("Client.handle_select_device_intention")
    async def handle_select_device_intention(self, sdi: SelectDeviceIntention):
        """Refer to new device gateway handshake diagram"""

        # take lock so we only add 1 device at once
        if self.select_device_lock.locked():
            return await self.close(GatewayCloseCode.INVALID_STATE, "already selecting a device")
        await self.select_device_lock.acquire()

        if not (waiter := self.controller.get_new_device_waiter(self.user_id or unwrap(), sdi.code)):
            self.select_device_lock.release()
            return await self.send(SelectDeviceIntentionFailure(
                op="select_device_intention_failure",
                failure_type=SelectDeviceIntentionFailure.Type.NOT_FOUND
            ))
        
        new_device_ch, future = waiter
        self.selected_device = waiter

        adddevicerequest = AddDeviceRequest(
            op="add_device_request",
            device_name=new_device_ch.device_name,
            device_public_key=new_device_ch.device_public_key,
        )

        await self.send(adddevicerequest)

    @tracer.start_as_current_span("Client.handle_add_device_ok")
    async def handle_add_device_ok(self, adok: AddDeviceOK):
        """Adds a new device"""
        if not self.select_device_lock.locked() or not self.selected_device:
            return await self.close(GatewayCloseCode.INVALID_STATE, "not currently selecting a device")
        
        new_device_ch, future = self.selected_device
        

        res = await read_devices(grpcdevice, self.user_id or unwrap(), count_only=True)

        if res.device_count >= USER_MAX_NUM_DEVICES:
            await self.send(SelectDeviceIntentionFailure(
                op="select_device_intention_failure",
                failure_type=SelectDeviceIntentionFailure.Type.DEVICE_LIMIT_REACHED)
            )


        res = await create_device(
            grpcdevice,
            user_id=self.user_id or unwrap(),
            device_name=new_device_ch.device_name,
            public_key=new_device_ch.device_public_key.to_bytes(),
            encrypted_account_key=adok.encrypted_account_key,
        )

        ndok = NewDeviceOK.from_rpc(res, new_device_ch.device_public_key)

        future.set_result(ndok)

        await self.send(ndok)

        self.selected_device = None
        self.select_device_lock.release()

    # User bulk request

    @tracer.start_as_current_span("Client.handle_user_bulk_request")
    async def handle_user_bulk_request(self, ubr: UserBulkRequest):
        user_ids = ubr.user_ids
        res = await get_bulk_users(grpcuser, user_ids)

        await self.send_event(events.UsersEvent(
            users=[UserSearchResponse.from_rpc(u) for u in res.users],
            errors=[(puuid_uuid(e.user_id) or unwrap(), e.error) for e in res.errors]
        ))


    # state handling

    async def handle_close(self, exc: ConnectionClosed):
        self.open = False
        if exc.sent:
            # we closed so we dont need to handle anything
            return
        if not (rcv := exc.rcvd):
            return
    

    @tracer.start_as_current_span("Client.close")
    async def close(self, code: int, reason: str) -> None:
        await self.ws.close(code=code, reason=reason)
        await self.cleanup()

    @tracer.start_as_current_span("Client.cleanup")
    async def cleanup(self) -> None:
        async with self.cleanup_lock:
            if self.cleaned_up:
                return
            self.cleaned_up = True

        self.queue.shutdown()
        await self.controller.unregister(self)
        self.open = False


    # handshaking

    @tracer.start_as_current_span("Client.handshake_get_next")
    async def handshake_get_next[T: BaseMessage](self, schema_or_schemas: Iterable[type[T]] | type[T]) -> T:
        """Get the next message from the client and fail if it is not of type[T]"""
        schemas = schema_or_schemas if isinstance(schema_or_schemas, Iterable) else (schema_or_schemas,)

        # this should not be called post handhshake, use the loop instead
        assert not self.handshake_complete
        # next should never return multiple events anyways
        try:
            d, = await asyncio.wait_for(self.next(), timeout=60)
        except TimeoutError as e:
            raise HandshakeFailed(HandshakeFailed.Reason.TIME_OUT, "Timed out waiting for message") from e
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


    @tracer.start_as_current_span("Client.handshake")
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
    
    @tracer.start_as_current_span("Client.new_device_handshake")
    async def new_device_handshake(self, clienthello: NewDeviceClientHello):
        username = clienthello.username

        try:
            user = await get_user_by_username(grpcuser, username)
        except RpcError as e:
            if e.code() != StatusCode.NOT_FOUND:
                raise
            raise HandshakeFailed(HandshakeFailed.Reason.BAD_AUTH, "no such user")

        one_time_code = onetimecode.generate()

        serverhello = NewDeviceServerHello(
            op="new_device_server_hello",
            code=one_time_code,
            gateway_id=str(self.controller.id),
        )

        await self.send(serverhello)


        try:
            ok = await self.controller.new_device_waiting(
                clienthello,
                puuid_uuid(user.user_id) or unwrap(),
                one_time_code
            )
        except TimeoutError as e:
            raise HandshakeFailed(HandshakeFailed.Reason.TIME_OUT, "Timed out waiting on other device") from e
    
        await self.send(ok)
        
        regular_clienthello = await self.handshake_get_next(ClientHello)
        return await self.regular_handshake(regular_clienthello)

        
    @tracer.start_as_current_span("Client.regular_handshake")
    async def regular_handshake(self, clienthello: ClientHello) -> UUID:

        user_id = clienthello.user_id
        device_id = clienthello.device_id

        try:
            # read device and user from grpc concurrently
            device, user = await asyncio.gather(
                get_device(grpcdevice, user_id, device_id),
                get_user(grpcuser, user_id)
            )
        except RpcError as e:
            if e.code() != StatusCode.NOT_FOUND:
                raise
            raise HandshakeFailed(HandshakeFailed.Reason.BAD_AUTH, "user not found") from e

        device_challenge = challenge.create_challenge(device.device_public_key)
        account_challenge = challenge.create_challenge(user.public_key)

        serverhello = ServerHello(
            op="server_hello",
            device_challenge=device_challenge.ciphertext,
            account_challenge=account_challenge.ciphertext,
            gateway_id=str(self.controller.id),
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

        

