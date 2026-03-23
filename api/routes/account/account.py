from typing import Annotated, cast

from uuid import UUID
import uuid

from fastapi import APIRouter, File, Header, Request, UploadFile
from grpc import StatusCode

from api import *

from api.routes.account.models import *
from api.types.asset import PublicAsset
from api.utils import RpcErrHandler, unwrap, ResourceNotFoundRpcHandler

from shared.py import asset
from shared.py.constraints import ASSET_MIN_SIZE, ICON_MAX_UPLOAD_SIZE, USER_MAX_NUM_DEVICES
from shared.py.grpc import mediaservices
from shared.py.intraservice.client import BigPictureClient
from shared.py.grpc.id import id_compare, puuid_opt, puuid_uuid, id_t, uuid_puuid
from shared.py.grpc.user import edit_user, get_user, get_user_by_username
from shared.py.pydantic.pem import PEMPublicKey
from shared.py.pydantic.common import Username
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpcgen import media_pb2_grpc, user_pb2_grpc
from shared.py.grpcgen import user_pb2
from shared.py.grpc.device import create_device, read_devices


CONF_AVATAR_CONTENT_TYPE = "image/webp" 


discovery = DiscoveryManager()
bigpicture = BigPictureClient()

AccountRouter = APIRouter()

grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)
grpcdevice = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserDeviceServiceStub)
grpcmedia = LazyGRPC(discovery.discover_mediaservices(), media_pb2_grpc.TransformerServiceStub)



@AccountRouter.post("/signup")
async def signup(r: Request, body: SignupBody) -> SignupResponse:

    body.username = body.username.lower()

    with RpcErrHandler(
        StatusCode.ALREADY_EXISTS,
        lambda: errors.BadRequest("username already exists", api_error_code=errors.ERROR_ALREADY_EXISTS)
    ):
        res = cast(user_pb2.ReadUserResponse, await grpcuser.stub.CreateUser(user_pb2.CreateUserRequest(
            username=body.username,
            email=body.email,
            public_key=body.account_public_key.to_bytes()
        )))

    try:
        device = await _create_device(res.user_id, body.device)
    except Exception as e:
        cast(user_pb2.DeleteUserResponse, await grpcuser.stub.DeleteUser(user_pb2.DeleteUserRequest(
            user_id=res.user_id
        )))
        raise ApiErrExc(errors.InternalServerError("Invalid transient state encountered during transaction")) from e



    return SignupResponse(
        user_id=puuid_uuid(res.user_id) or unwrap(),
        username=res.username,
        email=res.email,
        public_key=body.account_public_key,
        avatar_asset_id=puuid_uuid(res.avatar_asset_id),
        device=DeviceResponse.from_rpc(device)
    )

@AccountRouter.get("/devicehandshake/{user_identifier}/{device_id}")
async def device_key_handshake(r: Request, user_identifier: Username | UUID, device_id: UUID) -> DeviceKeyResponse:

    with ResourceNotFoundRpcHandler("user", user_identifier):
        if isinstance(user_identifier, str):
            user = await get_user_by_username(grpcuser, user_identifier)
        else:
            user = await get_user(grpcuser, user_identifier)

    res = await read_devices(grpcdevice, user.user_id)

    for device in res.devices:
        if id_compare(device.device_id, device_id):
            break
    else:
        raise ApiErrExc(errors.NotFound("No such device"))

    return DeviceKeyResponse(
        encrypted_account_key=device.encrypted_account_key,
        account_public_key=PEMPublicKey.from_bytes(user.public_key)
    )


async def _create_device(user_id: id_t, body: NewDeviceBody) -> user_pb2.DeviceObjectResponse:
    res = await read_devices(grpcdevice, user_id, count_only=True)

    if res.device_count >= USER_MAX_NUM_DEVICES:
        raise ApiErrExc(errors.BadRequest("Device limit reached", api_error_code=errors.ERROR_LIMIT_REACHED))

    return await create_device(
        grpcdevice,
        user_id=user_id,
        device_name=body.name,
        public_key=body.public_key.to_bytes(),
        encrypted_account_key=body.encrypted_private_key,
    )

@AccountRouter.get("/devices")
async def get_all_devices(r: Request, s: SessionParam) -> list[DeviceResponse]:

    res = await read_devices(grpcdevice, s.user_id)

    devices = []
    for device in res.devices:
        devices.append(DeviceResponse.from_rpc(device, s.user_id, account_key=False))
    return devices



@AccountRouter.post("/device")
async def new_device(r: Request, s: SessionParam, body: NewDeviceBody) -> DeviceResponse:

    res = await _create_device(user_id=s.user_id, body=body)

    return DeviceResponse.from_rpc(
        res,
        s.user_id,
        body.public_key
    )
    

@AccountRouter.delete("/device/{device_id}")
async def delete_device(r: Request, s: SessionParam, device_id: UUID) -> None:

    res = await read_devices(grpcdevice, s.user_id, count_only=True)

    if res.device_count <= 1:
        raise ApiErrExc(errors.BadRequest("Unable to delete a users only device", api_error_code=errors.ERROR_LIMIT_REACHED))

    
    res = cast(user_pb2.DeleteDeviceResponse, await grpcdevice.stub.DeleteDevice(user_pb2.DeleteDeviceRequest(
        user_id=uuid_puuid(s.user_id),
        device_id=uuid_puuid(device_id)
    )))

@AccountRouter.patch("/device/{device_id}")
async def patch_device(s: SessionParam, device_id: UUID, body: UpdateDeviceBody) -> DeviceResponse:
    res = cast(user_pb2.DeviceObjectResponse, await grpcdevice.stub.UpdateDevice(user_pb2.UpdateDeviceRequest(
        user_id=uuid_puuid(s.user_id),
        device_id=uuid_puuid(device_id),
        device_name=body.device_name
    )))

    return DeviceResponse(
        user_id=puuid_uuid(res.user_id) or unwrap(),
        device_id=puuid_uuid(res.device_id) or unwrap(),
        device_name=res.device_name,
        device_public_key=PEMPublicKey.from_bytes(res.device_public_key),
        encrypted_account_key=res.encrypted_account_key,
    )

@AccountRouter.get("/@me")
async def my_account(s: SessionParam) -> AccountResponse:
    res = await s.full_user()

    gateway = await bigpicture.get_node(s.user_id)

    return AccountResponse(
        user_id=s.user_id,
        avatar_asset_id=puuid_uuid(res.avatar_asset_id),
        public_key=PEMPublicKey.from_bytes(res.public_key),
        username=res.username,
        email=res.email,

        assigned_gateway=gateway
    )


@AccountRouter.put("/@me/icon")
async def set_my_icon(
    s: SessionParam,
    content_length: Annotated[int | None, Header(lt=ICON_MAX_UPLOAD_SIZE, gt=ASSET_MIN_SIZE)],
    icon: Annotated[UploadFile, File()]
) -> PublicAsset:
    user = await s.full_user()
    if user.HasField("avatar_asset_id"):
        await asset.delete_asset(public=True, bucket_id=s.user_id, asset_id=user.avatar_asset_id)

    user = await edit_user(
        grpcuser,
        user.user_id,
        make_avatar=True,
    )

    # creating a path None would be bad
    assert puuid_opt(user.avatar_asset_id)


    await mediaservices.transform_image(
        grpcmedia,
        public=True,
        bucket_id=s.user_id,
        asset_id=user.avatar_asset_id,
        mime_in=icon.content_type,
        mime_out=CONF_AVATAR_CONTENT_TYPE,
        data=await icon.read()
    )

    return PublicAsset(
        asset_id=puuid_uuid(user.avatar_asset_id) or unwrap(),
        bucket_id=s.user_id,
        public=True
    )

