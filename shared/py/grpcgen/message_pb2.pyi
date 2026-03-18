import plib_pb2 as _plib_pb2
from google.protobuf import field_mask_pb2 as _field_mask_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class CreateMessageRequest(_message.Message):
    __slots__ = ("channel_id", "message_type", "author_id", "opt_last_edited", "opt_content", "opt_attachment_asset_id")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_LAST_EDITED_FIELD_NUMBER: _ClassVar[int]
    OPT_CONTENT_FIELD_NUMBER: _ClassVar[int]
    OPT_ATTACHMENT_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    message_type: int
    author_id: _plib_pb2.pUUID
    opt_last_edited: int
    opt_content: bytes
    opt_attachment_asset_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_type: _Optional[int] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_last_edited: _Optional[int] = ..., opt_content: _Optional[bytes] = ..., opt_attachment_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class MessageObject(_message.Message):
    __slots__ = ("channel_id", "bucket", "message_id", "message_type", "author_id", "opt_last_edited", "opt_content", "opt_attachment_asset_id")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_LAST_EDITED_FIELD_NUMBER: _ClassVar[int]
    OPT_CONTENT_FIELD_NUMBER: _ClassVar[int]
    OPT_ATTACHMENT_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    bucket: int
    message_id: _plib_pb2.pUUID
    message_type: int
    author_id: _plib_pb2.pUUID
    opt_last_edited: int
    opt_content: bytes
    opt_attachment_asset_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., bucket: _Optional[int] = ..., message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_type: _Optional[int] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_last_edited: _Optional[int] = ..., opt_content: _Optional[bytes] = ..., opt_attachment_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdateMessageRequest(_message.Message):
    __slots__ = ("channel_id", "message_id", "message_type", "opt_last_edited", "opt_content", "opt_attachment_asset_id", "update_mask")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    OPT_LAST_EDITED_FIELD_NUMBER: _ClassVar[int]
    OPT_CONTENT_FIELD_NUMBER: _ClassVar[int]
    OPT_ATTACHMENT_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    UPDATE_MASK_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    message_id: _plib_pb2.pUUID
    message_type: int
    opt_last_edited: int
    opt_content: bytes
    opt_attachment_asset_id: _plib_pb2.pUUID
    update_mask: _field_mask_pb2.FieldMask
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_type: _Optional[int] = ..., opt_last_edited: _Optional[int] = ..., opt_content: _Optional[bytes] = ..., opt_attachment_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., update_mask: _Optional[_Union[_field_mask_pb2.FieldMask, _Mapping]] = ...) -> None: ...

class ReadMessageRequest(_message.Message):
    __slots__ = ("channel_id", "message_id")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    message_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteMessageRequest(_message.Message):
    __slots__ = ("channel_id", "message_id")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    message_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteMessageResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ReadMessagesRequest(_message.Message):
    __slots__ = ("channel_id", "before", "count", "latest_bucket")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    BEFORE_FIELD_NUMBER: _ClassVar[int]
    COUNT_FIELD_NUMBER: _ClassVar[int]
    LATEST_BUCKET_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    before: _plib_pb2.pUUID
    count: int
    latest_bucket: int
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., before: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., count: _Optional[int] = ..., latest_bucket: _Optional[int] = ...) -> None: ...

class ReadMessagesResponse(_message.Message):
    __slots__ = ("messages",)
    MESSAGES_FIELD_NUMBER: _ClassVar[int]
    messages: _containers.RepeatedCompositeFieldContainer[MessageObject]
    def __init__(self, messages: _Optional[_Iterable[_Union[MessageObject, _Mapping]]] = ...) -> None: ...
