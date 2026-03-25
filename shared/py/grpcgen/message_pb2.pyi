import plib_pb2 as _plib_pb2
from google.protobuf import field_mask_pb2 as _field_mask_pb2
from google.protobuf import wrappers_pb2 as _wrappers_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class CreateMessageRequest(_message.Message):
    __slots__ = ("channel_id", "message_type", "author_id", "opt_last_edited", "opt_content", "request_asset", "opt_in_reply_to")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_LAST_EDITED_FIELD_NUMBER: _ClassVar[int]
    OPT_CONTENT_FIELD_NUMBER: _ClassVar[int]
    REQUEST_ASSET_FIELD_NUMBER: _ClassVar[int]
    OPT_IN_REPLY_TO_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    message_type: int
    author_id: _plib_pb2.pUUID
    opt_last_edited: int
    opt_content: bytes
    request_asset: _wrappers_pb2.BoolValue
    opt_in_reply_to: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_type: _Optional[int] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_last_edited: _Optional[int] = ..., opt_content: _Optional[bytes] = ..., request_asset: _Optional[_Union[_wrappers_pb2.BoolValue, _Mapping]] = ..., opt_in_reply_to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class MessageObject(_message.Message):
    __slots__ = ("channel_id", "bucket", "message_id", "message_type", "author_id", "opt_last_edited", "opt_content", "opt_attachment_asset_id", "opt_in_reply_to")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    AUTHOR_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_LAST_EDITED_FIELD_NUMBER: _ClassVar[int]
    OPT_CONTENT_FIELD_NUMBER: _ClassVar[int]
    OPT_ATTACHMENT_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_IN_REPLY_TO_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    bucket: int
    message_id: _plib_pb2.pUUID
    message_type: int
    author_id: _plib_pb2.pUUID
    opt_last_edited: int
    opt_content: bytes
    opt_attachment_asset_id: _plib_pb2.pUUID
    opt_in_reply_to: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., bucket: _Optional[int] = ..., message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_type: _Optional[int] = ..., author_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_last_edited: _Optional[int] = ..., opt_content: _Optional[bytes] = ..., opt_attachment_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_in_reply_to: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdateMessageRequest(_message.Message):
    __slots__ = ("channel_id", "message_id", "content", "message_type")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_TYPE_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    message_id: _plib_pb2.pUUID
    content: _wrappers_pb2.BytesValue
    message_type: _wrappers_pb2.Int32Value
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., content: _Optional[_Union[_wrappers_pb2.BytesValue, _Mapping]] = ..., message_type: _Optional[_Union[_wrappers_pb2.Int32Value, _Mapping]] = ...) -> None: ...

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
