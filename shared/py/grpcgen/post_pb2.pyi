import plib_pb2 as _plib_pb2
from google.protobuf import wrappers_pb2 as _wrappers_pb2
from google.protobuf import field_mask_pb2 as _field_mask_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class CreatePostRequest(_message.Message):
    __slots__ = ("author_id", "post_type", "body", "timeline_type")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    POST_TYPE_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    post_type: int
    body: str
    timeline_type: int
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_type: _Optional[int] = ..., body: _Optional[str] = ..., timeline_type: _Optional[int] = ...) -> None: ...

class PostResponse(_message.Message):
    __slots__ = ("post_id", "author_id", "asset_id", "post_type", "body", "last_edited", "num_comments", "num_likes", "is_private", "liked_by_me")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    POST_TYPE_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    LAST_EDITED_FIELD_NUMBER: _ClassVar[int]
    NUM_COMMENTS_FIELD_NUMBER: _ClassVar[int]
    NUM_LIKES_FIELD_NUMBER: _ClassVar[int]
    IS_PRIVATE_FIELD_NUMBER: _ClassVar[int]
    LIKED_BY_ME_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    author_id: _plib_pb2.pUUID
    asset_id: _plib_pb2.pUUID
    post_type: int
    body: _wrappers_pb2.StringValue
    last_edited: _wrappers_pb2.Int64Value
    num_comments: int
    num_likes: int
    is_private: bool
    liked_by_me: _wrappers_pb2.BoolValue
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_type: _Optional[int] = ..., body: _Optional[_Union[_wrappers_pb2.StringValue, _Mapping]] = ..., last_edited: _Optional[_Union[_wrappers_pb2.Int64Value, _Mapping]] = ..., num_comments: _Optional[int] = ..., num_likes: _Optional[int] = ..., is_private: bool = ..., liked_by_me: _Optional[_Union[_wrappers_pb2.BoolValue, _Mapping]] = ...) -> None: ...

class ReadPostRequest(_message.Message):
    __slots__ = ("post_id", "author_id", "timeline_type", "liked_by")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    LIKED_BY_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    author_id: _plib_pb2.pUUID
    timeline_type: int
    liked_by: _plib_pb2.pUUID
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ..., liked_by: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdatePostRequest(_message.Message):
    __slots__ = ("author_id", "post_id", "timeline_type", "field_mask", "body", "is_private")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    FIELD_MASK_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    IS_PRIVATE_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    post_id: _plib_pb2.pUUID
    timeline_type: int
    field_mask: _field_mask_pb2.FieldMask
    body: _wrappers_pb2.StringValue
    is_private: _wrappers_pb2.BoolValue
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ..., field_mask: _Optional[_Union[_field_mask_pb2.FieldMask, _Mapping]] = ..., body: _Optional[_Union[_wrappers_pb2.StringValue, _Mapping]] = ..., is_private: _Optional[_Union[_wrappers_pb2.BoolValue, _Mapping]] = ...) -> None: ...

class DeletePostRequest(_message.Message):
    __slots__ = ("post_id", "author_id", "timeline_type")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    author_id: _plib_pb2.pUUID
    timeline_type: int
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ...) -> None: ...

class DeletePostResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class HalfReadPostRequest(_message.Message):
    __slots__ = ("post_id", "author_id")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    author_id: _plib_pb2.pUUID
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadManyPostsRequest(_message.Message):
    __slots__ = ("requests", "timeline_type", "liked_by")
    REQUESTS_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    LIKED_BY_FIELD_NUMBER: _ClassVar[int]
    requests: _containers.RepeatedCompositeFieldContainer[HalfReadPostRequest]
    timeline_type: int
    liked_by: _plib_pb2.pUUID
    def __init__(self, requests: _Optional[_Iterable[_Union[HalfReadPostRequest, _Mapping]]] = ..., timeline_type: _Optional[int] = ..., liked_by: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ManyPostsResponse(_message.Message):
    __slots__ = ("responses",)
    RESPONSES_FIELD_NUMBER: _ClassVar[int]
    responses: _containers.RepeatedCompositeFieldContainer[PostResponse]
    def __init__(self, responses: _Optional[_Iterable[_Union[PostResponse, _Mapping]]] = ...) -> None: ...

class ReadUserPostsRequest(_message.Message):
    __slots__ = ("author_id", "limit", "timeline_type", "before")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    BEFORE_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    limit: int
    timeline_type: int
    before: _plib_pb2.pUUID
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., limit: _Optional[int] = ..., timeline_type: _Optional[int] = ..., before: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UserPostsResponse(_message.Message):
    __slots__ = ("posts",)
    POSTS_FIELD_NUMBER: _ClassVar[int]
    posts: _containers.RepeatedCompositeFieldContainer[PostResponse]
    def __init__(self, posts: _Optional[_Iterable[_Union[PostResponse, _Mapping]]] = ...) -> None: ...

class ReadUsersDehydratedPostsRequest(_message.Message):
    __slots__ = ("author_ids", "limit", "timeline_type", "before", "after")
    AUTHOR_IDS_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    BEFORE_FIELD_NUMBER: _ClassVar[int]
    AFTER_FIELD_NUMBER: _ClassVar[int]
    author_ids: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    limit: int
    timeline_type: int
    before: _plib_pb2.pUUID
    after: int
    def __init__(self, author_ids: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., limit: _Optional[int] = ..., timeline_type: _Optional[int] = ..., before: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., after: _Optional[int] = ...) -> None: ...

class UsersDehydratedPostsResponse(_message.Message):
    __slots__ = ("posts",)
    POSTS_FIELD_NUMBER: _ClassVar[int]
    posts: _containers.RepeatedCompositeFieldContainer[DehydratedPosts]
    def __init__(self, posts: _Optional[_Iterable[_Union[DehydratedPosts, _Mapping]]] = ...) -> None: ...

class DehydratedPosts(_message.Message):
    __slots__ = ("user_id", "post_ids")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    POST_IDS_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    post_ids: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_ids: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ...) -> None: ...

class LikePostRequest(_message.Message):
    __slots__ = ("post_id", "liker_id")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    LIKER_ID_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    liker_id: _plib_pb2.pUUID
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., liker_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class LikePostResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
