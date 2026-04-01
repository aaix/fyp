from typing import Literal, cast

from enum import IntEnum

from shared.py.grpc.id import id_puuid, id_t
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpcgen.post_pb2 import CreatePostRequest, DeletePostRequest, DeletePostResponse, ReadPostResponse, ReadUserPostsRequest, ReadUserPostsResponse
from shared.py.grpcgen.post_pb2_grpc import PostServiceStub

# posts are bucketed by their author so that a read my posts call will coalesce with read post call
# this could be changed if taylor swifts leave load unbalanced


class PostType(IntEnum):
    PENDING = 0
    IMAGE = 1
    VIDEO = 2
    SHORT_FORM = 3

    def valid_as_user_input(self) -> bool:
        return self != self.PENDING

    def get_content_type(self) -> Literal["video/webm", "image/webp"]:
        match self:
            case self.PENDING:
                raise TypeError("Pending media does not have a known content type")
            case self.IMAGE:
                return "image/webp"
            case self.VIDEO:
                return "video/webm"
            case self.SHORT_FORM:
                return "video/webm"




async def create_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    *,
    post_type: PostType,
    content_type: str,
    body: str | None

) -> ReadPostResponse:
    stub = await lazy(author_id)
    return cast(ReadPostResponse, await stub.CreatePost(CreatePostRequest(
        author_id=id_puuid(author_id),
        post_type=post_type.value,
        content_type=content_type,
        body=body
    )))


async def delete_post(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    post_id: id_t,
):
    stub = await lazy(author_id)
    cast(DeletePostResponse, await stub.DeletePost(DeletePostRequest(
        post_id=id_puuid(post_id),
        author_id=id_puuid(author_id)
    )))

async def read_users_posts(
    lazy: DataservicesLazyGRPC[PostServiceStub],
    author_id: id_t,
    *,
    before: id_t | None, 
    limit: int = 15
) -> ReadUserPostsResponse:
    stub = await lazy(author_id)

    return cast(ReadUserPostsResponse, await stub.ReadUserPosts(ReadUserPostsRequest(
        author_id=id_puuid(author_id),
        limit=limit,
        before=id_puuid(before) if before is not None else None,
    )))