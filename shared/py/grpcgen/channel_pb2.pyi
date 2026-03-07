import plib_pb2 as _plib_pb2
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
    opt_channel_name: str
    opt_channel_icon_asset_id: _plib_pb2.pUUID
    def __init__(self, channel_type: _Optional[int] = ..., opt_channel_name: _Optional[str] = ..., opt_channel_icon_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UpdateChannelRequest(_message.Message):
    __slots__ = ("channel_id", "opt_channel_name", "opt_channel_icon_asset_id")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_ICON_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    opt_channel_name: str
    opt_channel_icon_asset_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_channel_name: _Optional[str] = ..., opt_channel_icon_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

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
    __slots__ = ("channel_id", "channel_type", "opt_channel_name", "channel_members", "opt_channel_icon_asset_id")
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_TYPE_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_NAME_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_MEMBERS_FIELD_NUMBER: _ClassVar[int]
    OPT_CHANNEL_ICON_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    channel_id: _plib_pb2.pUUID
    channel_type: int
    opt_channel_name: str
    channel_members: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    opt_channel_icon_asset_id: _plib_pb2.pUUID
    def __init__(self, channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_type: _Optional[int] = ..., opt_channel_name: _Optional[str] = ..., channel_members: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ..., opt_channel_icon_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class GetUserChannelsRequest(_message.Message):
    __slots__ = ("user_id",)
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class UserChannelsResponse(_message.Message):
    __slots__ = ("channels",)
    CHANNELS_FIELD_NUMBER: _ClassVar[int]
    channels: _containers.RepeatedCompositeFieldContainer[ChannelObjectResponse]
    def __init__(self, channels: _Optional[_Iterable[_Union[ChannelObjectResponse, _Mapping]]] = ...) -> None: ...

class AddChannelMemberRequest(_message.Message):
    __slots__ = ("user_id", "encrypted_channel_key")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_KEY_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    encrypted_channel_key: bytes
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., encrypted_channel_key: _Optional[bytes] = ...) -> None: ...

class ChannelMemberObject(_message.Message):
    __slots__ = ("user_id", "channel_id", "encrypted_channel_key", "last_accessed")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_CHANNEL_KEY_FIELD_NUMBER: _ClassVar[int]
    LAST_ACCESSED_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    encrypted_channel_key: bytes
    last_accessed: int
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., encrypted_channel_key: _Optional[bytes] = ..., last_accessed: _Optional[int] = ...) -> None: ...

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
    __slots__ = ("members",)
    MEMBERS_FIELD_NUMBER: _ClassVar[int]
    members: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    def __init__(self, members: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ...) -> None: ...

class RemoveChannelMembersResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class UpdateChannelMemberRequest(_message.Message):
    __slots__ = ("user_id", "channel_id")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    CHANNEL_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    channel_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., channel_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...
