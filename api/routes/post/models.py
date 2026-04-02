from typing import Self

from uuid import UUID

from pydantic import BaseModel

from api.utils import unwrap
from shared.py.asset import generate_signed_get
from shared.py.grpc.id import puuid_uuid
from shared.py.grpc.post import PostType
from shared.py.grpcgen import post_pb2
from shared.py.grpcgen.plib_pb2 import pUUID
from shared.py.pydantic.common import PostBody
from shared.py.pydantic.form import FormableBaseModel
from shared.py.types import UNSET

__all__ = (
    "NewPostBody",
    "PostResponse",
    "PostsResponse",
    "EditPostBody",
    "FeedResponse",
)


async def create_post_url_presigned(post_id: pUUID, asset_id: pUUID) -> str:
    return await generate_signed_get(
        public=False,
        bucket_id=post_id,
        asset_id=asset_id,
        duration=300,
    )



class NewPostBody(FormableBaseModel):
    post_type: PostType
    body: str | None = None


class PostResponse(BaseModel):
    post_id: UUID
    author_id: UUID
    asset_url: str
    post_type: PostType
    body: PostBody | None
    last_edited: int | None
    num_comments: int
    num_likes: int
    is_private: bool

    @classmethod
    async def from_rpc(cls, rpc: post_pb2.PostResponse) -> Self:

        asset_url = await create_post_url_presigned(rpc.post_id, rpc.asset_id)
        

        return cls(
            post_id=puuid_uuid(rpc.post_id) or unwrap(),
            author_id=puuid_uuid(rpc.author_id) or unwrap(),
            asset_url=asset_url,
            post_type=PostType(rpc.post_type),
            body=rpc.body.value if rpc.HasField("body") else None,
            last_edited=rpc.last_edited.value if rpc.HasField("last_edited") else None,
            num_comments=rpc.num_comments,
            num_likes=rpc.num_likes,
            is_private=rpc.is_private,
        )

class PostsResponse(BaseModel):
    posts: list[PostResponse]

class EditPostBody(BaseModel):
    body: str | None = None

class FeedResponse(BaseModel):
    posts: list[PostResponse]