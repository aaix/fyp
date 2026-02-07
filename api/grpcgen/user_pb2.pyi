import plib_pb2 as _plib_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ReadUserRequest(_message.Message):
    __slots__ = ("user_id",)
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadUserByUsernameRequest(_message.Message):
    __slots__ = ("username",)
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    username: str
    def __init__(self, username: _Optional[str] = ...) -> None: ...

class ReadUserResponse(_message.Message):
    __slots__ = ("user_id", "avatar_asset_id", "public_key", "username", "email")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    AVATAR_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    avatar_asset_id: _plib_pb2.pUUID
    public_key: bytes
    username: str
    email: str
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., avatar_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., public_key: _Optional[bytes] = ..., username: _Optional[str] = ..., email: _Optional[str] = ...) -> None: ...

class CreateUserRequest(_message.Message):
    __slots__ = ("username", "email", "public_key")
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    username: str
    email: str
    public_key: bytes
    def __init__(self, username: _Optional[str] = ..., email: _Optional[str] = ..., public_key: _Optional[bytes] = ...) -> None: ...

class UpdateUserRequest(_message.Message):
    __slots__ = ("user_id", "username", "avatar_asset_id")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    AVATAR_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    username: str
    avatar_asset_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., username: _Optional[str] = ..., avatar_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteUserRequest(_message.Message):
    __slots__ = ("user_id",)
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteUserResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CheckUsernameResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CreateDeviceRequest(_message.Message):
    __slots__ = ("user_id", "device_name", "public_key", "encrypted_account_key")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    DEVICE_NAME_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_ACCOUNT_KEY_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    device_name: str
    public_key: bytes
    encrypted_account_key: bytes
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., device_name: _Optional[str] = ..., public_key: _Optional[bytes] = ..., encrypted_account_key: _Optional[bytes] = ...) -> None: ...

class DeviceObjectResponse(_message.Message):
    __slots__ = ("device_id", "user_id", "device_name", "device_public_key", "encrypted_account_key")
    DEVICE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    DEVICE_NAME_FIELD_NUMBER: _ClassVar[int]
    DEVICE_PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_ACCOUNT_KEY_FIELD_NUMBER: _ClassVar[int]
    device_id: _plib_pb2.pUUID
    user_id: _plib_pb2.pUUID
    device_name: str
    device_public_key: bytes
    encrypted_account_key: bytes
    def __init__(self, device_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., device_name: _Optional[str] = ..., device_public_key: _Optional[bytes] = ..., encrypted_account_key: _Optional[bytes] = ...) -> None: ...

class ReadDevicesRequest(_message.Message):
    __slots__ = ("user_id", "count_only")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    COUNT_ONLY_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    count_only: bool
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., count_only: bool = ...) -> None: ...

class ReadDevicesResponse(_message.Message):
    __slots__ = ("device_count", "devices")
    DEVICE_COUNT_FIELD_NUMBER: _ClassVar[int]
    DEVICES_FIELD_NUMBER: _ClassVar[int]
    device_count: int
    devices: _containers.RepeatedCompositeFieldContainer[DeviceObjectResponse]
    def __init__(self, device_count: _Optional[int] = ..., devices: _Optional[_Iterable[_Union[DeviceObjectResponse, _Mapping]]] = ...) -> None: ...

class UpdateDeviceRequest(_message.Message):
    __slots__ = ("user_id", "device_id", "device_name", "device_public_key", "encrypted_account_key")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    DEVICE_ID_FIELD_NUMBER: _ClassVar[int]
    DEVICE_NAME_FIELD_NUMBER: _ClassVar[int]
    DEVICE_PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    ENCRYPTED_ACCOUNT_KEY_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    device_id: _plib_pb2.pUUID
    device_name: str
    device_public_key: bytes
    encrypted_account_key: bytes
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., device_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., device_name: _Optional[str] = ..., device_public_key: _Optional[bytes] = ..., encrypted_account_key: _Optional[bytes] = ...) -> None: ...

class DeleteDeviceRequest(_message.Message):
    __slots__ = ("user_id", "device_id")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    DEVICE_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    device_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., device_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteDeviceResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CreateFriendshipInviteRequest(_message.Message):
    __slots__ = ("from_user_id", "to_user_id")
    FROM_USER_ID_FIELD_NUMBER: _ClassVar[int]
    TO_USER_ID_FIELD_NUMBER: _ClassVar[int]
    from_user_id: _plib_pb2.pUUID
    to_user_id: _plib_pb2.pUUID
    def __init__(self, from_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., to_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class FriendshipInviteResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class FriendshipInviteObject(_message.Message):
    __slots__ = ("user_id",)
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadRecvFriendshipInvitesRequest(_message.Message):
    __slots__ = ("to_user_id",)
    TO_USER_ID_FIELD_NUMBER: _ClassVar[int]
    to_user_id: _plib_pb2.pUUID
    def __init__(self, to_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadRecvFriendshipInviteResponse(_message.Message):
    __slots__ = ("invites",)
    INVITES_FIELD_NUMBER: _ClassVar[int]
    invites: _containers.RepeatedCompositeFieldContainer[FriendshipInviteObject]
    def __init__(self, invites: _Optional[_Iterable[_Union[FriendshipInviteObject, _Mapping]]] = ...) -> None: ...

class ReadSentFriendshipInvitesRequest(_message.Message):
    __slots__ = ("from_user_id",)
    FROM_USER_ID_FIELD_NUMBER: _ClassVar[int]
    from_user_id: _plib_pb2.pUUID
    def __init__(self, from_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadSentFriendshipInviteResponse(_message.Message):
    __slots__ = ("invites",)
    INVITES_FIELD_NUMBER: _ClassVar[int]
    invites: _containers.RepeatedCompositeFieldContainer[FriendshipInviteObject]
    def __init__(self, invites: _Optional[_Iterable[_Union[FriendshipInviteObject, _Mapping]]] = ...) -> None: ...

class DeleteFriendshipInviteRequest(_message.Message):
    __slots__ = ("from_user_id", "to_user_id")
    FROM_USER_ID_FIELD_NUMBER: _ClassVar[int]
    TO_USER_ID_FIELD_NUMBER: _ClassVar[int]
    from_user_id: _plib_pb2.pUUID
    to_user_id: _plib_pb2.pUUID
    def __init__(self, from_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., to_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteFriendshipInviteResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CreateFriendshipRequest(_message.Message):
    __slots__ = ("user_id_1", "user_id_2")
    USER_ID_1_FIELD_NUMBER: _ClassVar[int]
    USER_ID_2_FIELD_NUMBER: _ClassVar[int]
    user_id_1: _plib_pb2.pUUID
    user_id_2: _plib_pb2.pUUID
    def __init__(self, user_id_1: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id_2: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class FriendshipObjectResponse(_message.Message):
    __slots__ = ("user_id_1", "user_id_2", "created_at")
    USER_ID_1_FIELD_NUMBER: _ClassVar[int]
    USER_ID_2_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    user_id_1: _plib_pb2.pUUID
    user_id_2: _plib_pb2.pUUID
    created_at: int
    def __init__(self, user_id_1: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id_2: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., created_at: _Optional[int] = ...) -> None: ...

class ReadFriendshipsRequest(_message.Message):
    __slots__ = ("user_id",)
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class FriendshipsObjectResponse(_message.Message):
    __slots__ = ("user_id", "created_at")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    created_at: int
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., created_at: _Optional[int] = ...) -> None: ...

class ReadFriendshipsResponse(_message.Message):
    __slots__ = ("friendships",)
    FRIENDSHIPS_FIELD_NUMBER: _ClassVar[int]
    friendships: _containers.RepeatedCompositeFieldContainer[FriendshipsObjectResponse]
    def __init__(self, friendships: _Optional[_Iterable[_Union[FriendshipsObjectResponse, _Mapping]]] = ...) -> None: ...

class DeleteFriendshipRequest(_message.Message):
    __slots__ = ("user_id_1", "user_id_2")
    USER_ID_1_FIELD_NUMBER: _ClassVar[int]
    USER_ID_2_FIELD_NUMBER: _ClassVar[int]
    user_id_1: _plib_pb2.pUUID
    user_id_2: _plib_pb2.pUUID
    def __init__(self, user_id_1: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id_2: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteFriendshipResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CreateBlockedUserRequest(_message.Message):
    __slots__ = ("blocker_user_id", "blocked_user_id")
    BLOCKER_USER_ID_FIELD_NUMBER: _ClassVar[int]
    BLOCKED_USER_ID_FIELD_NUMBER: _ClassVar[int]
    blocker_user_id: _plib_pb2.pUUID
    blocked_user_id: _plib_pb2.pUUID
    def __init__(self, blocker_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., blocked_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class BlockedUserObjectResponse(_message.Message):
    __slots__ = ("blocker_user_id", "blocked_user_id")
    BLOCKER_USER_ID_FIELD_NUMBER: _ClassVar[int]
    BLOCKED_USER_ID_FIELD_NUMBER: _ClassVar[int]
    blocker_user_id: _plib_pb2.pUUID
    blocked_user_id: _plib_pb2.pUUID
    def __init__(self, blocker_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., blocked_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadBlockedUsersRequest(_message.Message):
    __slots__ = ("blocker_user_id",)
    BLOCKER_USER_ID_FIELD_NUMBER: _ClassVar[int]
    blocker_user_id: _plib_pb2.pUUID
    def __init__(self, blocker_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class BlockedUsersObjectResponse(_message.Message):
    __slots__ = ("blocked_user_id",)
    BLOCKED_USER_ID_FIELD_NUMBER: _ClassVar[int]
    blocked_user_id: _plib_pb2.pUUID
    def __init__(self, blocked_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadBlockedUsersResponse(_message.Message):
    __slots__ = ("blocked_users",)
    BLOCKED_USERS_FIELD_NUMBER: _ClassVar[int]
    blocked_users: _containers.RepeatedCompositeFieldContainer[BlockedUsersObjectResponse]
    def __init__(self, blocked_users: _Optional[_Iterable[_Union[BlockedUsersObjectResponse, _Mapping]]] = ...) -> None: ...

class ReadBlockedUserRequest(_message.Message):
    __slots__ = ("blocker_user_id", "blocked_user_id")
    BLOCKER_USER_ID_FIELD_NUMBER: _ClassVar[int]
    BLOCKED_USER_ID_FIELD_NUMBER: _ClassVar[int]
    blocker_user_id: _plib_pb2.pUUID
    blocked_user_id: _plib_pb2.pUUID
    def __init__(self, blocker_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., blocked_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteBlockedUserRequest(_message.Message):
    __slots__ = ("blocker_user_id", "blocked_user_id")
    BLOCKER_USER_ID_FIELD_NUMBER: _ClassVar[int]
    BLOCKED_USER_ID_FIELD_NUMBER: _ClassVar[int]
    blocker_user_id: _plib_pb2.pUUID
    blocked_user_id: _plib_pb2.pUUID
    def __init__(self, blocker_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., blocked_user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class DeleteBlockedUserResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
