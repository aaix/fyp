from contextlib import AsyncExitStack
import random
from typing import Annotated, Literal, cast

import asyncio
from enum import IntEnum
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, UploadFile
from grpc import RpcError, StatusCode

from api import *
from api import feed
from api.responses import ErrorResponse
from api.routes.post.models import *
from api.tracing import tracer
from api.types.params import PostParam, TimelineTypeParam, UserParam, UserWithProfileVisibleParam
from api.utils import RpcErrHandler, unwrap
from shared.py.asset import delete_asset
from shared.py.constraints import POST_MEDIA_MAX_UPLOAD_SIZE, THUMBNAIL_MAX_HEIGHT, THUMBNAIL_MAX_WIDTH
from shared.py.grpc import gc, mediaservices
from shared.py.grpc.feed import TimelineType
from shared.py.grpc.id import id_compare
from shared.py.grpc.lazy import DataservicesLazyGRPC, LazyGRPC
from shared.py.grpc.post import PostType, create_post, delete_post, edit_post, like_post, read_users_posts, unlike_post
from shared.py.grpc.relationship import can_i_view_peer_profile
from shared.py.grpcgen import gc_pb2_grpc, media_pb2_grpc, post_pb2, post_pb2_grpc
from shared.py.grpcgen.internalmessage_pb2 import EventPostUpdate
from shared.py.intraservice.events import send_to_remote
from shared.py.types import UNSET


CONF_POST_LARGE_THRESHOLD = 50_000


discovery = DiscoveryManager()

PostRouter = APIRouter()

grpcmedia = LazyGRPC(discovery.discover_mediaservices(), media_pb2_grpc.TransformerServiceStub, discovery.mediaservices_auth())
grpcpost = DataservicesLazyGRPC(post_pb2_grpc.PostServiceStub)
grpcgarbage = DataservicesLazyGRPC(gc_pb2_grpc.GarbageServiceStub)

class PostUpdateType(IntEnum):
    CREATED = 0
    TRANSCODING = 1
    TRANSCODED = 2
    FANNING_OUT = 3
    FANNED_OUT = 4
    COMPLETED = 5

    ERROR = 99

async def send_post_update(post: PostParam, update: PostUpdateType):
    await send_to_remote(post.author_id, "post_update", EventPostUpdate(
        post_id=post.post_id,
        state=update.value
    ))

@tracer.start_as_current_span("post.background.new_post_task")
async def new_post_task(
    post: PostParam,
    content_type: Literal['video/webm', 'image/webp'],
    attachment: UploadFile,
    timeline_type: TimelineType
) -> PostParam:
    
    try:
        await send_post_update(post, PostUpdateType.CREATED)
        match content_type:
            case "video/webm":
                asset_provider = mediaservices.transform_video
            case  "image/webp":
                asset_provider = mediaservices.transform_image
            case unknown:
                unwrap(unknown)
        
        await send_post_update(post, PostUpdateType.TRANSCODING)

        try:
            await asset_provider(
                grpcmedia,
                public=False,
                bucket_id=post.post_id,
                asset_id=post.asset_id,
                mime_in=attachment.content_type,
                mime_out=content_type,
                data= attachment,
                dimensions=None,
                thumb_dimensions=(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT)
            )
        except Exception:
            await delete_asset(public=False, bucket_id=post.post_id, asset_id=post.asset_id)
            await delete_asset(public=False, bucket_id=post.post_id, asset_id=post.asset_id, extra="/thumb")
            await delete_post(grpcpost, post.author_id, post.post_id, timeline_type)
            raise
        await send_post_update(post, PostUpdateType.TRANSCODED)

        # post created successfully 
        # now to deal with feed fan out

        edited = await edit_post(grpcpost, post.author_id, post.post_id, timeline_type, is_private=False)
        await send_post_update(post, PostUpdateType.FANNING_OUT)

        await feed.fan_out(post.author_id, timeline_type, post.post_id)

        await send_post_update(post, PostUpdateType.FANNED_OUT)



        await send_post_update(post, PostUpdateType.COMPLETED)

        return edited

    except Exception:
        await send_post_update(post, PostUpdateType.ERROR)
        raise
        

@PostRouter.post("/{timeline_type}")
async def new_post(
    request: Request,
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

    task = asyncio.create_task(new_post_task(post, content_type, attachment, timeline_type))

    completed, pending = await asyncio.wait((task,), timeout=3.5)

    if len(completed) > 0:
        task, = completed
        post = task.result()
    else:
        task, = pending
        loop = task.get_loop()

        # stupid hack to stop fastapi "cleaning up" our file
        file_stack = request.scope.get("fastapi_middleware_astack")
        assert file_stack
        new_stack = file_stack.pop_all()
        task.add_done_callback(lambda _: loop.create_task(new_stack.aclose()))




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
    await delete_asset(public=False, bucket_id=post.post_id, asset_id=post.asset_id, extra="/thumb")
    await delete_post(grpcpost, post.author_id, post.post_id, timeline_type)
    await gc.file_for_gc(grpcgarbage, post.post_id, gc.GarbageType.POST, gc.GarbageFlags.LARGE if post.large.value else gc.GarbageFlags(0))

@PostRouter.get("/user/{user_id}/{timeline_type}/{post_id}")
async def get_post(s: SessionParam, user: UserWithProfileVisibleParam, post: PostParam) -> PostResponse:
    return await PostResponse.from_rpc(post)


@PostRouter.put("/user/{user_id}/{timeline_type}/{post_id}/like")
async def r_like_post(s: SessionParam, user: UserWithProfileVisibleParam, post: PostParam) -> None:

    post_is_large = post.large.value

    with RpcErrHandler(StatusCode.INVALID_ARGUMENT, lambda e: errors.BadRequest(e.details() or "invalid argument")):
        await like_post(grpcpost, post.post_id, s.user_id, log_bucket=not post_is_large)

    # check every ~1000 likes if we meet the large threshold
    if random.randint(0, 1000) != 314:
        return
    
    if post.num_likes > CONF_POST_LARGE_THRESHOLD and not post_is_large:
        timeline_type = PostType(post.post_type).to_feed_type()
        await edit_post(grpcpost, post.author_id, post.post_id, timeline_type, large=True)

@PostRouter.delete("/user/{user_id}/{timeline_type}/{post_id}/like")
async def r_unlike_post(s: SessionParam, user: UserWithProfileVisibleParam, post: PostParam) -> None:
    with RpcErrHandler(StatusCode.INVALID_ARGUMENT, lambda e: errors.BadRequest(e.details() or "invalid argument")):
        await unlike_post(grpcpost, post.post_id, s.user_id)
