from collections.abc import Iterable, Iterator
from functools import partial
from itertools import chain
from typing import Literal, cast

import asyncio
from enum import IntEnum

from google.protobuf.wrappers_pb2 import BoolValue, Int32Value, StringValue
from google.protobuf.field_mask_pb2 import FieldMask

from shared.py.grpc import instrument_call
from shared.py.grpc.feed import TimelineType
from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen.feed_pb2 import FeedEntry
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.grpcgen.post_pb2 import *
from shared.py.grpcgen.post_pb2_grpc import PostServiceStub
from shared.py.misc import bucketby
from shared.py.tracing import tracer
from shared.py.types import UNSET, MaybeUnset


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
    
    stub = await lazy(post_id)
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

@instrument_call
@tracer.start_as_current_span("posts.scatter_gather_user_dehydrated")
async def scatter_gather_users_dehydrated_posts(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    timeline_type: TimelineType,
    user_ids: Iterable[pUUID],
    limit: int,
    before: id_t | None,
    after: int | None,
) -> list[DehydratedPosts]:
    buckets = await bucketby(user_ids, lazy)

    partial_req = partial(ReadUsersDehydratedPostsRequest,
        limit=limit,
        timeline_type=timeline_type.value,
        before=id_puuid(before) if before else None,
        after=after,
    )


    res = cast(list[UsersDehydratedPostsResponse], await asyncio.gather(*(
        grpc.ReadUsersDehydratedPosts(partial_req(author_ids=users)) for grpc, users in buckets.items()
    )))
    return list(chain(*(posts.posts for posts in res)))


def _entries_to_request(timeline_type: TimelineType, entries: Iterable[FeedEntry]) -> ReadManyPostsRequest:

    requests = [
        ReadPostRequest(
            post_id=e.post_id,
            author_id=e.post_author_id,
            timeline_type=timeline_type.value
        )
        for e in entries
    ]

    return ReadManyPostsRequest(
        requests=requests
    )

@tracer.start_as_current_span("posts.scatter_gather_posts")
async def scatter_gather_posts(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    timeline_type: TimelineType,
    posts: Iterable[FeedEntry]
) -> list[PostResponse]:
    buckets = await bucketby(posts, lambda e: lazy(e.post_id))

    res = cast(list[ManyPostsResponse], await asyncio.gather(*(
        grpc.ReadManyPosts(_entries_to_request(timeline_type, entries)) for grpc, entries in buckets.items()
    )))
    return list(chain(*(posts.responses for posts in res)))

async def like_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    post_id: id_t,
    liker_id: id_t
):
    # no point coalescing on post_id
    stub = await lazy(liker_id)

    cast(LikePostResponse, await stub.LikePost(LikePostRequest(
        post_id=id_puuid(post_id),
        liker_id=id_puuid(liker_id)
    )))

async def unlike_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    post_id: id_t,
    liker_id: id_t
):
    stub = await lazy(liker_id)

    cast(LikePostResponse, await stub.UnlikePost(LikePostRequest(
        post_id=id_puuid(post_id),
        liker_id=id_puuid(liker_id)
    )))