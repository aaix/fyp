from typing import Literal, cast

from enum import IntEnum

from google.protobuf.wrappers_pb2 import BoolValue, Int32Value, StringValue
from google.protobuf.field_mask_pb2 import FieldMask

from shared.py.grpc.feed import TimelineType
from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen.post_pb2 import CreatePostRequest, DeletePostRequest, DeletePostResponse, ReadPostRequest, PostResponse, ReadUserPostsRequest, UserPostsResponse, UpdatePostRequest
from shared.py.grpcgen.post_pb2_grpc import PostServiceStub
from shared.py.types import UNSET, MaybeUnset

# posts are bucketed by their author so that a read my posts call will coalesce with read post call
# this could be changed if taylor swifts leave load unbalanced


class PostType(IntEnum):
    IMAGE = 1
    VIDEO = 2
    SHORT_FORM = 3

    def get_content_type(self) -> Literal["video/webm", "image/webp"]:
        match self:

            case self.IMAGE:
                return "image/webp"
            case self.VIDEO:
                return "video/webm"
            case self.SHORT_FORM:
                return "video/webm"
    
    def to_feed_type(self) -> TimelineType:
        match self:
            case self.IMAGE:
                return TimelineType.MAIN
            case self.VIDEO:
                return TimelineType.MAIN
            case self.SHORT_FORM:
                return TimelineType.SHORT_FORM




async def create_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    timeline_type: TimelineType,
    *,
    post_type: PostType,
    body: str | None,

) -> PostResponse:
    stub = await lazy(author_id)
    return cast(PostResponse, await stub.CreatePost(CreatePostRequest(
        author_id=id_puuid(author_id),
        post_type=post_type.value,
        body=body,
        timeline_type=timeline_type.value,
    )))


async def delete_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    post_id: id_t,
    timeline_type: TimelineType,
):
    stub = await lazy(author_id)
    cast(DeletePostResponse, await stub.DeletePost(DeletePostRequest(
        post_id=id_puuid(post_id),
        author_id=id_puuid(author_id),
        timeline_type=timeline_type.value,
    )))

async def read_users_posts(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    timeline_type: TimelineType,
    *,
    before: id_t | None, 
    limit: int = 15
) -> UserPostsResponse:
    stub = await lazy(author_id)

    return cast(UserPostsResponse, await stub.ReadUserPosts(ReadUserPostsRequest(
        author_id=id_puuid(author_id),
        limit=limit,
        before=id_puuid(before) if before is not None else None,
        timeline_type=timeline_type.value,
    )))

async def read_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    post_id: id_t,
    timeline_type: TimelineType,
) -> PostResponse:
    
    stub = await lazy(author_id)
    return cast(PostResponse, await stub.ReadPost(ReadPostRequest(
        post_id=id_puuid(post_id),
        author_id=id_puuid(author_id),
        timeline_type=timeline_type,
    )))

async def edit_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    post_id: id_t,
    timeline_type: TimelineType,
    *,
    body: MaybeUnset[str | None] = UNSET,
    is_private: MaybeUnset[bool] = UNSET,
) -> PostResponse:
    
    stub = await lazy(author_id)

    field_mask = FieldMask()
    if body is not UNSET:
        field_mask.paths.append("body")

    return cast(PostResponse, await stub.UpdatePost(UpdatePostRequest(
        author_id=id_puuid(author_id),
        post_id=id_puuid(post_id),
        body=StringValue(value=body) if body else None,
        is_private=BoolValue(value=is_private) if is_private is not UNSET else None,
        field_mask=field_mask,
        timeline_type=timeline_type.value,
    )))