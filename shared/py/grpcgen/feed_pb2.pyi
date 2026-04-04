import plib_pb2 as _plib_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ReadFeedMetaRequest(_message.Message):
    __slots__ = ("user_id", "timeline_type")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    timeline_type: int
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ...) -> None: ...

class FeedMetaResponse(_message.Message):
    __slots__ = ("user_id", "timeline_type", "last_fanned_in_at", "exclude_users", "explicit_fan_in_users", "fanned_in_up_to")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    LAST_FANNED_IN_AT_FIELD_NUMBER: _ClassVar[int]
    EXCLUDE_USERS_FIELD_NUMBER: _ClassVar[int]
    EXPLICIT_FAN_IN_USERS_FIELD_NUMBER: _ClassVar[int]
    FANNED_IN_UP_TO_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    timeline_type: int
    last_fanned_in_at: int
    exclude_users: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    explicit_fan_in_users: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    fanned_in_up_to: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ..., last_fanned_in_at: _Optional[int] = ..., exclude_users: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., explicit_fan_in_users: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., fanned_in_up_to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdateFeedMetaRequest(_message.Message):
    __slots__ = ("user_id", "timeline_type", "last_fanned_in_at", "fanned_in_up_to", "exclude_to_add", "exclude_to_delete", "explicit_fan_in_to_add", "explicit_fan_in_to_delete")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    LAST_FANNED_IN_AT_FIELD_NUMBER: _ClassVar[int]
    FANNED_IN_UP_TO_FIELD_NUMBER: _ClassVar[int]
    EXCLUDE_TO_ADD_FIELD_NUMBER: _ClassVar[int]
    EXCLUDE_TO_DELETE_FIELD_NUMBER: _ClassVar[int]
    EXPLICIT_FAN_IN_TO_ADD_FIELD_NUMBER: _ClassVar[int]
    EXPLICIT_FAN_IN_TO_DELETE_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    timeline_type: int
    last_fanned_in_at: int
    fanned_in_up_to: _plib_pb2.pUUID
    exclude_to_add: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    exclude_to_delete: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    explicit_fan_in_to_add: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    explicit_fan_in_to_delete: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ..., last_fanned_in_at: _Optional[int] = ..., fanned_in_up_to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., exclude_to_add: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., exclude_to_delete: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., explicit_fan_in_to_add: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., explicit_fan_in_to_delete: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ...) -> None: ...

class ReadFeedRequest(_message.Message):
    __slots__ = ("user_id", "timeline_type", "before", "limit")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    BEFORE_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    timeline_type: int
    before: _plib_pb2.pUUID
    limit: int
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ..., before: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., limit: _Optional[int] = ...) -> None: ...

class FeedEntry(_message.Message):
    __slots__ = ("post_author_id", "post_id", "entry_type")
    POST_AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    ENTRY_TYPE_FIELD_NUMBER: _ClassVar[int]
    post_author_id: _plib_pb2.pUUID
    post_id: _plib_pb2.pUUID
    entry_type: int
    def __init__(self, post_author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., entry_type: _Optional[int] = ...) -> None: ...

class FeedResponse(_message.Message):
    __slots__ = ("entries",)
    ENTRIES_FIELD_NUMBER: _ClassVar[int]
    entries: _containers.RepeatedCompositeFieldContainer[FeedEntry]
    def __init__(self, entries: _Optional[_Iterable[_Union[FeedEntry, _Mapping]]] = ...) -> None: ...

class AddToFeedsRequest(_message.Message):
    __slots__ = ("user_ids", "timeline_type", "author_id", "post_id", "entry_type")
    USER_IDS_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    ENTRY_TYPE_FIELD_NUMBER: _ClassVar[int]
    user_ids: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    timeline_type: int
    author_id: _plib_pb2.pUUID
    post_id: _plib_pb2.pUUID
    entry_type: int
    def __init__(self, user_ids: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., timeline_type: _Optional[int] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., entry_type: _Optional[int] = ...) -> None: ...

class AddToFeedsResponse(_message.Message):
    __slots__ = ("successes",)
    SUCCESSES_FIELD_NUMBER: _ClassVar[int]
    successes: int
    def __init__(self, successes: _Optional[int] = ...) -> None: ...

class PartialFeedEntry(_message.Message):
    __slots__ = ("author_id", "post_id")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    post_id: _plib_pb2.pUUID
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class RemovePostsFromFeedRequest(_message.Message):
    __slots__ = ("user_id", "timeline_type", "to_remove")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    TO_REMOVE_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    timeline_type: int
    to_remove: _containers.RepeatedCompositeFieldContainer[PartialFeedEntry]
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ..., to_remove: _Optional[_Iterable[_Union[PartialFeedEntry, _Mapping]]] = ...) -> None: ...

class RemovePostsFromFeedResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class AddPostsToFeedRequest(_message.Message):
    __slots__ = ("user_id", "timeline_type", "to_add", "entry_type")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMELINE_TYPE_FIELD_NUMBER: _ClassVar[int]
    TO_ADD_FIELD_NUMBER: _ClassVar[int]
    ENTRY_TYPE_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    timeline_type: int
    to_add: _containers.RepeatedCompositeFieldContainer[PartialFeedEntry]
    entry_type: int
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., timeline_type: _Optional[int] = ..., to_add: _Optional[_Iterable[_Union[PartialFeedEntry, _Mapping]]] = ..., entry_type: _Optional[int] = ...) -> None: ...

class AddPostsToFeedResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
