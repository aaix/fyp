import plib_pb2 as _plib_pb2
from google.protobuf import field_mask_pb2 as _field_mask_pb2
from google.protobuf import wrappers_pb2 as _wrappers_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class CreateChannelRequest(_message.Message):
    __slots__ = ("channel_type", "opt_channel_name", "opt_channel_icon_asset_id")
    CHANNEL_TYPE_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_ICON_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    channel_type: int
    opt_channel_name: bytes
    opt_channel_icon_asset_id: _plib_pb2.pUUID
    def __init__(self, channel_type: _Optional[int] = ..., opt_channel_name: _Optional[bytes] = ..., opt_channel_icon_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdateChannelRequest(_message.Message):
    __slots__ = ("channel_id", "opt_channel_name", "request_icon", "update_mask", "members_to_update", "last_bucket")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    REQUEST_ICON_FIELD_NUMBER: _ClassVar[int]
    UPDATE_MASK_FIELD_NUMBER: _ClassVar[int]
    MEMBERS_TO_UPDATE_FIELD_NUMBER: _ClassVar[int]
    LAST_BUCKET_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    opt_channel_name: bytes
    request_icon: _wrappers_pb2.BoolValue
    update_mask: _field_mask_pb2.FieldMask
    members_to_update: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    last_bucket: int
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_channel_name: _Optional[bytes] = ..., request_icon: _Optional[_Union[_wrappers_pb2.BoolValue, _Mapping]] = ..., update_mask: _Optional[_Union[_field_mask_pb2.FieldMask, _Mapping]] = ..., members_to_update: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., last_bucket: _Optional[int] = ...) -> None: ...

class ReadChannelRequest(_message.Message):
    __slots__ = ("channel_id",)
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteChannelRequest(_message.Message):
    __slots__ = ("channel_id",)
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteChannelResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ChannelObjectResponse(_message.Message):
    __slots__ = ("channel_id", "channel_type", "latest_bucket", "opt_channel_name", "channel_members", "opt_channel_icon_asset_id")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_TYPE_FIELD_NUMBER: _ClassVar[int]
    LATEST_BUCKET_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_MEMBERS_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_ICON_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    channel_type: int
    latest_bucket: int
    opt_channel_name: bytes
    channel_members: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    opt_channel_icon_asset_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_type: _Optional[int] = ..., latest_bucket: _Optional[int] = ..., opt_channel_name: _Optional[bytes] = ..., channel_members: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., opt_channel_icon_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class GetUserChannelsRequest(_message.Message):
    __slots__ = ("user_id",)
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UserChannelsResponse(_message.Message):
    __slots__ = ("channels",)
    CHANNELS_FIELD_NUMBER: _ClassVar[int]
    channels: _containers.RepeatedCompositeFieldContainer[ChannelMemberObject]
    def __init__(self, channels: _Optional[_Iterable[_Union[ChannelMemberObject, _Mapping]]] = ...) -> None: ...

class AddChannelMemberRequest(_message.Message):
    __slots__ = ("user_id", "encrypted_channel_key")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_KEY_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    encrypted_channel_key: bytes
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., encrypted_channel_key: _Optional[bytes] = ...) -> None: ...

class ChannelMemberObject(_message.Message):
    __slots__ = ("user_id", "channel_id", "encrypted_channel_key", "last_acked_message_id", "opt_channel_name", "opt_channel_icon_asset_id")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_KEY_FIELD_NUMBER: _ClassVar[int]
    LAST_ACKED_MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_ICON_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    encrypted_channel_key: bytes
    last_acked_message_id: _plib_pb2.pUUID
    opt_channel_name: bytes
    opt_channel_icon_asset_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., encrypted_channel_key: _Optional[bytes] = ..., last_acked_message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_channel_name: _Optional[bytes] = ..., opt_channel_icon_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class AddChannelMembersRequest(_message.Message):
    __slots__ = ("channel_id", "channel", "requests")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_FIELD_NUMBER: _ClassVar[int]
    REQUESTS_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    channel: CreateChannelRequest
    requests: _containers.RepeatedCompositeFieldContainer[AddChannelMemberRequest]
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel: _Optional[_Union[CreateChannelRequest, _Mapping]] = ..., requests: _Optional[_Iterable[_Union[AddChannelMemberRequest, _Mapping]]] = ...) -> None: ...

class AddChannelMembersResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class RemoveChannelMembersRequest(_message.Message):
    __slots__ = ("channel_id", "members")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    MEMBERS_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    members: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., members: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ...) -> None: ...

class RemoveChannelMembersResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class UpdateChannelMemberRequest(_message.Message):
    __slots__ = ("user_id", "channel_id", "last_acked_message_id")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    LAST_ACKED_MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    last_acked_message_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., last_acked_message_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdateChannelMemberResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
