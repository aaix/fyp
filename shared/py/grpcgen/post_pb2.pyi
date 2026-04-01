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
    __slots__ = ("author_id", "post_type", "content_type", "body")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    POST_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    post_type: int
    content_type: str
    body: str
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_type: _Optional[int] = ..., content_type: _Optional[str] = ..., body: _Optional[str] = ...) -> None: ...

class ReadPostResponse(_message.Message):
    __slots__ = ("post_id", "author_id", "asset_id", "post_type", "content_type", "body", "last_edited", "num_comments", "num_likes")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    POST_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    LAST_EDITED_FIELD_NUMBER: _ClassVar[int]
    NUM_COMMENTS_FIELD_NUMBER: _ClassVar[int]
    NUM_LIKES_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    author_id: _plib_pb2.pUUID
    asset_id: _plib_pb2.pUUID
    post_type: int
    content_type: str
    body: _wrappers_pb2.StringValue
    last_edited: _wrappers_pb2.Int64Value
    num_comments: int
    num_likes: int
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_type: _Optional[int] = ..., content_type: _Optional[str] = ..., body: _Optional[_Union[_wrappers_pb2.StringValue, _Mapping]] = ..., last_edited: _Optional[_Union[_wrappers_pb2.Int64Value, _Mapping]] = ..., num_comments: _Optional[int] = ..., num_likes: _Optional[int] = ...) -> None: ...

class ReadPostRequest(_message.Message):
    __slots__ = ("post_id", "author_id")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    author_id: _plib_pb2.pUUID
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdatePostRequest(_message.Message):
    __slots__ = ("author_id", "post_id", "body", "post_type", "field_mask")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    BODY_FIELD_NUMBER: _ClassVar[int]
    POST_TYPE_FIELD_NUMBER: _ClassVar[int]
    FIELD_MASK_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    post_id: _plib_pb2.pUUID
    body: _wrappers_pb2.StringValue
    post_type: _wrappers_pb2.Int32Value
    field_mask: _field_mask_pb2.FieldMask
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., body: _Optional[_Union[_wrappers_pb2.StringValue, _Mapping]] = ..., post_type: _Optional[_Union[_wrappers_pb2.Int32Value, _Mapping]] = ..., field_mask: _Optional[_Union[_field_mask_pb2.FieldMask, _Mapping]] = ...) -> None: ...

class DeletePostRequest(_message.Message):
    __slots__ = ("post_id", "author_id")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    author_id: _plib_pb2.pUUID
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeletePostResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ReadManyPostsRequest(_message.Message):
    __slots__ = ("requests",)
    REQUESTS_FIELD_NUMBER: _ClassVar[int]
    requests: _containers.RepeatedCompositeFieldContainer[ReadPostRequest]
    def __init__(self, requests: _Optional[_Iterable[_Union[ReadPostRequest, _Mapping]]] = ...) -> None: ...

class ReadManyPostsResponse(_message.Message):
    __slots__ = ("responses",)
    RESPONSES_FIELD_NUMBER: _ClassVar[int]
    responses: _containers.RepeatedCompositeFieldContainer[ReadPostResponse]
    def __init__(self, responses: _Optional[_Iterable[_Union[ReadPostResponse, _Mapping]]] = ...) -> None: ...

class ReadUserPostsRequest(_message.Message):
    __slots__ = ("author_id", "limit", "before")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    BEFORE_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    limit: int
    before: _plib_pb2.pUUID
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., limit: _Optional[int] = ..., before: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadUserPostsResponse(_message.Message):
    __slots__ = ("posts",)
    POSTS_FIELD_NUMBER: _ClassVar[int]
    posts: _containers.RepeatedCompositeFieldContainer[ReadPostResponse]
    def __init__(self, posts: _Optional[_Iterable[_Union[ReadPostResponse, _Mapping]]] = ...) -> None: ...
