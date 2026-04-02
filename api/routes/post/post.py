
import asyncio
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, UploadFile

from api import *
from api.routes.post.models import *
from api.types.params import PostParam, TimelineTypeParam, UserParam, UserWithProfileVisibleParam
from api.utils import unwrap
from shared.py.asset import delete_asset
from shared.py.constraints import POST_MEDIA_MAX_UPLOAD_SIZE
from shared.py.grpc import mediaservices
from shared.py.grpc.id import id_compare
from shared.py.grpc.lazy import DataservicesLazyGRPC, LazyGRPC
from shared.py.grpc.post import PostType, create_post, delete_post, edit_post, read_users_posts
from shared.py.grpc.relationship import can_i_view_peer_profile
from shared.py.grpcgen import media_pb2_grpc, post_pb2, post_pb2_grpc
from shared.py.types import UNSET

discovery = DiscoveryManager()

PostRouter = APIRouter()

grpcmedia = LazyGRPC(discovery.discover_mediaservices(), media_pb2_grpc.TransformerServiceStub)
grpcpost = DataservicesLazyGRPC(post_pb2_grpc.PostServiceStub)



@PostRouter.post("/{timeline_type}")
async def new_post(
    s: SessionParam,
    body: Annotated[NewPostBody, Depends(NewPostBody.from_form)],
    attachment: UploadFile,
    timeline_type: TimelineTypeParam,
    content_length: Annotated[int, Header(lt=POST_MEDIA_MAX_UPLOAD_SIZE, gt=1)],
) -> PostResponse:
    
    content_type = body.post_type.get_content_type()

    post_type = body.post_type
    
    post = await create_post(
        grpcpost,
        s.user_id,
        post_type=post_type,
        body=body.body,
        timeline_type=post_type.to_feed_type()
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
        await delete_post(grpcpost, post.author_id, post.post_id, timeline_type)
        raise

    # post created successfully 
    # now to deal with feed fan out

    await edit_post(grpcpost, post.author_id, post.post_id, timeline_type, is_private=False)

    return await PostResponse.from_rpc(post)

@PostRouter.get("/user/{user_id}/{timeline_type}")
async def get_users_posts(
    s: SessionParam,
    user: UserWithProfileVisibleParam,
    timeline_type: TimelineTypeParam,
    before: Annotated[UUID | None, Query()] = None,
) -> PostsResponse:

    rpc = await read_users_posts(
        grpcpost,
        user.user_id,
        timeline_type,
        before=before,
    )

    posts = await asyncio.gather(*(PostResponse.from_rpc(post) for post in rpc.posts))

    return PostsResponse(
        posts=posts
    )



@PostRouter.patch("/user/{user_id}/{timeline_type}/{post_id}")
async def edit_my_post(s: SessionParam, post: PostParam, body: EditPostBody, timeline_type: TimelineTypeParam) -> PostResponse:
    if not id_compare(s.user_id, post.author_id):
        raise ApiErrExc(errors.Forbidden("Cannot edit another users post"))
    
    new_body = body.body if "body" in body.model_fields_set else UNSET

    if new_body is UNSET:
        raise ApiErrExc(errors.BadRequest("Expected something to change", api_error_code=errors.ERROR_INVALID_BODY_PARTS))

    rpc = await edit_post(
        grpcpost,
        post.author_id,
        post.post_id,
        timeline_type,
        body=new_body
    )

    return await PostResponse.from_rpc(rpc)

@PostRouter.delete("/user/{user_id}/{timeline_type}/{post_id}")
async def delete_my_post(s: SessionParam, post: PostParam, timeline_type: TimelineTypeParam) -> None:
    if not id_compare(s.user_id, post.author_id):
        raise ApiErrExc(errors.Forbidden("Cannot edit another users post"))
    
    await delete_asset(public=False, bucket_id=post.post_id, asset_id=post.asset_id)

    await delete_post(grpcpost, post.author_id, post.post_id, timeline_type)

@PostRouter.get("/user/{user_id}/{timeline_type}/{post_id}")
async def get_post(s: SessionParam, user: UserWithProfileVisibleParam, post: PostParam) -> PostResponse:
    return await PostResponse.from_rpc(post)