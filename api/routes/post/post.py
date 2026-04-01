
import asyncio
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, UploadFile

from api import *
from api.routes.post.models import *
from api.types.params import UserParam, UserWithProfileVisibleParam
from api.utils import unwrap
from shared.py.grpc import mediaservices
from shared.py.grpc.lazy import DataservicesLazyGRPC, LazyGRPC
from shared.py.grpc.post import PostType, create_post, delete_post, read_users_posts
from shared.py.grpc.relationship import can_i_view_peer_profile
from shared.py.grpcgen import media_pb2_grpc, post_pb2, post_pb2_grpc

discovery = DiscoveryManager()

PostRouter = APIRouter()

grpcmedia = LazyGRPC(discovery.discover_mediaservices(), media_pb2_grpc.TransformerServiceStub)
grpcpost = DataservicesLazyGRPC(post_pb2_grpc.PostServiceStub)



@PostRouter.post("/post")
async def new_post(
    s: SessionParam,
    body: Annotated[NewPostBody, Depends(NewPostBody.from_form)],
    attachment: UploadFile
) -> PostResponse:
    
    if not body.post_type.valid_as_user_input():
        raise ApiErrExc(errors.BadRequest("Post type is not valid as user supplied"))

    content_type = body.post_type.get_content_type()

    
    post = await create_post(
        grpcpost,
        s.user_id,
        post_type=PostType.PENDING,
        body=body.body,
        content_type=content_type,
    )

    match content_type:
        case "video/webm":
            asset_provider = mediaservices.transform_video
        case  "image/webp":
            asset_provider = mediaservices.transform_image
        case unknown:
            unwrap(unknown)
    
    try:
        await asset_provider(
            grpcmedia,
            public=False,
            bucket_id=post.post_id,
            asset_id=post.asset_id,
            mime_in=attachment.content_type,
            mime_out=content_type,
            data= attachment,
            dimensions=None
        )
    except Exception:
        await delete_post(grpcpost, post.author_id, post.post_id)
        raise

    # post created successfully 
    # now to deal with feed fan out

    return await PostResponse.from_rpc(post)

@PostRouter.get("/user/{user_id}/posts")
async def get_users_posts(s: SessionParam, user: UserWithProfileVisibleParam, before: Annotated[UUID | None, Query()] = None) -> PostsResponse:

    rpc = await read_users_posts(
        grpcpost,
        user.user_id,
        before=before,
    )

    posts = await asyncio.gather(*(PostResponse.from_rpc(post) for post in rpc.posts))

    return PostsResponse(
        posts=posts
    )

    
    