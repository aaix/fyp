import plib_pb2 as _plib_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class IntraMessage(_message.Message):
    __slots__ = ("session_create", "channel_create", "friendship_update", "message_create", "user_typing", "message_delete", "message_update", "post_update")
    SESSION_CREATE_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_CREATE_FIELD_NUMBER: _ClassVar[int]
    FRIENDSHIP_UPDATE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_CREATE_FIELD_NUMBER: _ClassVar[int]
    USER_TYPING_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_DELETE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_UPDATE_FIELD_NUMBER: _ClassVar[int]
    POST_UPDATE_FIELD_NUMBER: _ClassVar[int]
    session_create: EventSessionCreate
    channel_create: EventChannelCreate
    friendship_update: EventFriendshipUpdate
    message_create: EventMessageCreate
    user_typing: EventUserTyping
    message_delete: EventMessageDelete
    message_update: EventMessageUpdate
    post_update: EventPostUpdate
    def __init__(self, session_create: _Optional[_Union[EventSessionCreate, _Mapping]] = ..., channel_create: _Optional[_Union[EventChannelCreate, _Mapping]] = ..., friendship_update: _Optional[_Union[EventFriendshipUpdate, _Mapping]] = ..., message_create: _Optional[_Union[EventMessageCreate, _Mapping]] = ..., user_typing: _Optional[_Union[EventUserTyping, _Mapping]] = ..., message_delete: _Optional[_Union[EventMessageDelete, _Mapping]] = ..., message_update: _Optional[_Union[EventMessageUpdate, _Mapping]] = ..., post_update: _Optional[_Union[EventPostUpdate, _Mapping]] = ...) -> None: ...

class EventSessionCreate(_message.Message):
    __slots__ = ("ipaddress",)
    IPADDRESS_FIELD_NUMBER: _ClassVar[int]
    ipaddress: int
    def __init__(self, ipaddress: _Optional[int] = ...) -> None: ...

class EventChannelCreate(_message.Message):
    __slots__ = ("channel_id", "encrypted_channel_name", "encrypted_channel_key", "icon_url")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_KEY_FIELD_NUMBER: _ClassVar[int]
    ICON_URL_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    encrypted_channel_name: bytes
    encrypted_channel_key: bytes
    icon_url: str
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., encrypted_channel_name: _Optional[bytes] = ..., encrypted_channel_key: _Optional[bytes] = ..., icon_url: _Optional[str] = ...) -> None: ...

class EventFriendshipUpdate(_message.Message):
    __slots__ = ("peer_id", "relationship_type")
    PEER_ID_FIELD_NUMBER: _ClassVar[int]
    RELATIONSHIP_TYPE_FIELD_NUMBER: _ClassVar[int]
    peer_id: _plib_pb2.pUUID
    relationship_type: int
    def __init__(self, peer_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., relationship_type: _Optional[int] = ...) -> None: ...

class EventMessageCreate(_message.Message):
    __slots__ = ("author_id", "message_id", "channel_id", "content", "additional_content", "message_type", "in_reply_to")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    ADDITIONAL_CONTENT_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    IN_REPLY_TO_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    message_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    content: bytes
    additional_content: bytes
    message_type: int
    in_reply_to: _plib_pb2.pUUID
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., content: _Optional[bytes] = ..., additional_content: _Optional[bytes] = ..., message_type: _Optional[int] = ..., in_reply_to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class EventMessageUpdate(_message.Message):
    __slots__ = ("message_id", "channel_id", "new_content", "new_message_type", "attachment_url")
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    NEW_CONTENT_FIELD_NUMBER: _ClassVar[int]
    NEW_MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    ATTACHMENT_URL_FIELD_NUMBER: _ClassVar[int]
    message_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    new_content: bytes
    new_message_type: int
    attachment_url: str
    def __init__(self, message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., new_content: _Optional[bytes] = ..., new_message_type: _Optional[int] = ..., attachment_url: _Optional[str] = ...) -> None: ...

class EventMessageDelete(_message.Message):
    __slots__ = ("message_id", "channel_id")
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    message_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    def __init__(self, message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class EventUserTyping(_message.Message):
    __slots__ = ("author_id", "channel_id")
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    author_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    def __init__(self, author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class EventPostUpdate(_message.Message):
    __slots__ = ("post_id", "state")
    POST_ID_FIELD_NUMBER: _ClassVar[int]
    STATE_FIELD_NUMBER: _ClassVar[int]
    post_id: _plib_pb2.pUUID
    state: int
    def __init__(self, post_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., state: _Optional[int] = ...) -> None: ...
