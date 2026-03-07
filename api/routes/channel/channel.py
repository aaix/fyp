from fastapi import APIRouter

from api import *
from api.middleware.auth import SessionParam
from api.routes.channel.models import *

from shared.py.grpc.id import uuid_puuid
from shared.py.grpc.lazy import LazyGRPC
from shared.py.grpc.relationship import RelationshipType, test_many_relationships
from shared.py.grpcgen.user_pb2 import TestManyRelationshipEntry
from shared.py.grpcgen.user_pb2_grpc import UserRelationshipServiceStub



discovery = DiscoveryManager()

ChannelRouter = APIRouter()

grpcrelationship = LazyGRPC(discovery.discover_dataservices(), UserRelationshipServiceStub)


@ChannelRouter.post("/")
async def new_channel(s: SessionParam, body: NewChannelBody) -> NewChannelResponse:
    member_ids = set(cm.user_id for cm in body.channel_members)

    if not len(member_ids) == len(body.channel_members):
        raise ApiErrExc(errors.BadRequest("Channel members should not contain duplicates", api_error_code=errors.ERROR_INVALID_BODY_PARTS))    

    if s.user_id in member_ids:
        raise ApiErrExc(errors.BadRequest("Channel members should not contain yourself", api_error_code=errors.ERROR_INVALID_BODY_PARTS))

    # test that current user is friends with all users
    test_res = await test_many_relationships(
        grpcrelationship,
        s.user_id,
        (TestManyRelationshipEntry(user_id_b=uuid_puuid(peer_id), relationship_type=RelationshipType.FRIENDS) for peer_id in member_ids)
    )

    if test_res.errors > 0:
        raise ApiErrExc(errors.InternalServerError("Error resolving relationship with members"))

    if test_res.exist != len(member_ids):
        raise ApiErrExc(errors.BadRequest("Only friends can be added to chats", api_error_code=errors.ERROR_USER_NOT_FRIENDS))


    return NewChannelResponse()
    