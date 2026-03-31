import plib_pb2 as _plib_pb2
from google.protobuf import wrappers_pb2 as _wrappers_pb2
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

class ReadUserBulkRequest(_message.Message):
    __slots__ = ("user_ids",)
    USER_IDS_FIELD_NUMBER: _ClassVar[int]
    user_ids: _containers.RepeatedCompositeFieldContainer[_plib_pb2.pUUID]
    def __init__(self, user_ids: _Optional[_Iterable[_Union[_plib_pb2.pUUID, _Mapping]]] = ...) -> None: ...

class ReadUserByUsernameRequest(_message.Message):
    __slots__ = ("username",)
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    username: str
    def __init__(self, username: _Optional[str] = ...) -> None: ...

class ReadUserResponse(_message.Message):
    __slots__ = ("user_id", "avatar_asset_id", "public_key", "username", "email", "is_public")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    AVATAR_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    IS_PUBLIC_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    avatar_asset_id: _plib_pb2.pUUID
    public_key: bytes
    username: str
    email: str
    is_public: bool
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., avatar_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., public_key: _Optional[bytes] = ..., username: _Optional[str] = ..., email: _Optional[str] = ..., is_public: bool = ...) -> None: ...

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
    __slots__ = ("user_id", "username", "opt_make_avatar_asset_id", "opt_is_public")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    OPT_MAKE_AVATAR_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_IS_PUBLIC_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    username: str
    opt_make_avatar_asset_id: _wrappers_pb2.BoolValue
    opt_is_public: _wrappers_pb2.BoolValue
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., username: _Optional[str] = ..., opt_make_avatar_asset_id: _Optional[_Union[_wrappers_pb2.BoolValue, _Mapping]] = ..., opt_is_public: _Optional[_Union[_wrappers_pb2.BoolValue, _Mapping]] = ...) -> None: ...

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

class UsernameSearch(_message.Message):
    __slots__ = ("query",)
    QUERY_FIELD_NUMBER: _ClassVar[int]
    query: str
    def __init__(self, query: _Optional[str] = ...) -> None: ...

class BulkUserResponse(_message.Message):
    __slots__ = ("users", "errors")
    USERS_FIELD_NUMBER: _ClassVar[int]
    ERRORS_FIELD_NUMBER: _ClassVar[int]
    users: _containers.RepeatedCompositeFieldContainer[UserSearchEntry]
    errors: _containers.RepeatedCompositeFieldContainer[UserError]
    def __init__(self, users: _Optional[_Iterable[_Union[UserSearchEntry, _Mapping]]] = ..., errors: _Optional[_Iterable[_Union[UserError, _Mapping]]] = ...) -> None: ...

class UserError(_message.Message):
    __slots__ = ("user_id", "error")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    error: str
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., error: _Optional[str] = ...) -> None: ...

class UserSearchEntry(_message.Message):
    __slots__ = ("user_id", "opt_avatar_asset_id", "username", "public_key")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    OPT_AVATAR_ASSET_ID_FIELD_NUMBER: _ClassVar[int]
    USERNAME_FIELD_NUMBER: _ClassVar[int]
    PUBLIC_KEY_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    opt_avatar_asset_id: _plib_pb2.pUUID
    username: str
    public_key: bytes
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., opt_avatar_asset_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., username: _Optional[str] = ..., public_key: _Optional[bytes] = ...) -> None: ...

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

class ReadDeviceRequest(_message.Message):
    __slots__ = ("device_id", "user_id")
    DEVICE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    device_id: _plib_pb2.pUUID
    user_id: _plib_pb2.pUUID
    def __init__(self, device_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

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

class CreateRelationshipRequest(_message.Message):
    __slots__ = ("user_id_a", "user_id_b", "a_to_b_type", "b_to_a_type")
    USER_ID_A_FIELD_NUMBER: _ClassVar[int]
    USER_ID_B_FIELD_NUMBER: _ClassVar[int]
    A_TO_B_TYPE_FIELD_NUMBER: _ClassVar[int]
    B_TO_A_TYPE_FIELD_NUMBER: _ClassVar[int]
    user_id_a: _plib_pb2.pUUID
    user_id_b: _plib_pb2.pUUID
    a_to_b_type: int
    b_to_a_type: int
    def __init__(self, user_id_a: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id_b: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., a_to_b_type: _Optional[int] = ..., b_to_a_type: _Optional[int] = ...) -> None: ...

class ReadRelationshipRequest(_message.Message):
    __slots__ = ("user_id_a", "user_id_b", "relationship_types")
    USER_ID_A_FIELD_NUMBER: _ClassVar[int]
    USER_ID_B_FIELD_NUMBER: _ClassVar[int]
    RELATIONSHIP_TYPES_FIELD_NUMBER: _ClassVar[int]
    user_id_a: _plib_pb2.pUUID
    user_id_b: _plib_pb2.pUUID
    relationship_types: _containers.RepeatedScalarFieldContainer[int]
    def __init__(self, user_id_a: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id_b: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., relationship_types: _Optional[_Iterable[int]] = ...) -> None: ...

class RelationshipObject(_message.Message):
    __slots__ = ("user_id_a", "user_id_b", "relationship_type", "created_at")
    USER_ID_A_FIELD_NUMBER: _ClassVar[int]
    USER_ID_B_FIELD_NUMBER: _ClassVar[int]
    RELATIONSHIP_TYPE_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    user_id_a: _plib_pb2.pUUID
    user_id_b: _plib_pb2.pUUID
    relationship_type: int
    created_at: _plib_pb2.pUUID
    def __init__(self, user_id_a: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., user_id_b: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., relationship_type: _Optional[int] = ..., created_at: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class ReadRelationshipResponse(_message.Message):
    __slots__ = ("relationships",)
    RELATIONSHIPS_FIELD_NUMBER: _ClassVar[int]
    relationships: _containers.RepeatedCompositeFieldContainer[RelationshipObject]
    def __init__(self, relationships: _Optional[_Iterable[_Union[RelationshipObject, _Mapping]]] = ...) -> None: ...

class TestManyRelationshipEntry(_message.Message):
    __slots__ = ("user_id_b", "relationship_type")
    USER_ID_B_FIELD_NUMBER: _ClassVar[int]
    RELATIONSHIP_TYPE_FIELD_NUMBER: _ClassVar[int]
    user_id_b: _plib_pb2.pUUID
    relationship_type: int
    def __init__(self, user_id_b: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., relationship_type: _Optional[int] = ...) -> None: ...

class TestManyRelationshipsRequest(_message.Message):
    __slots__ = ("user_id", "tests")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    TESTS_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    tests: _containers.RepeatedCompositeFieldContainer[TestManyRelationshipEntry]
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., tests: _Optional[_Iterable[_Union[TestManyRelationshipEntry, _Mapping]]] = ...) -> None: ...

class TestManyRelationshipsResponse(_message.Message):
    __slots__ = ("exist", "errors")
    EXIST_FIELD_NUMBER: _ClassVar[int]
    ERRORS_FIELD_NUMBER: _ClassVar[int]
    exist: int
    errors: int
    def __init__(self, exist: _Optional[int] = ..., errors: _Optional[int] = ...) -> None: ...

class RelationshipTestResponse(_message.Message):
    __slots__ = ("exists",)
    EXISTS_FIELD_NUMBER: _ClassVar[int]
    exists: bool
    def __init__(self, exists: bool = ...) -> None: ...

class ReadRelationshipsRequest(_message.Message):
    __slots__ = ("user_id", "relationship_type", "before", "limit")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    RELATIONSHIP_TYPE_FIELD_NUMBER: _ClassVar[int]
    BEFORE_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    relationship_type: int
    before: _plib_pb2.pUUID
    limit: int
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., relationship_type: _Optional[int] = ..., before: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., limit: _Optional[int] = ...) -> None: ...

class HalfRelationship(_message.Message):
    __slots__ = ("user_id_b", "created_at")
    USER_ID_B_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    user_id_b: _plib_pb2.pUUID
    created_at: _plib_pb2.pUUID
    def __init__(self, user_id_b: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., created_at: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class RelationshipsResponse(_message.Message):
    __slots__ = ("relationships",)
    RELATIONSHIPS_FIELD_NUMBER: _ClassVar[int]
    relationships: _containers.RepeatedCompositeFieldContainer[HalfRelationship]
    def __init__(self, relationships: _Optional[_Iterable[_Union[HalfRelationship, _Mapping]]] = ...) -> None: ...

class DeleteRelationshipResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class GetUserRelationshipCountsRequest(_message.Message):
    __slots__ = ("user_id",)
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ...) -> None: ...

class GetUserRelationshipCountsResponse(_message.Message):
    __slots__ = ("user_id", "num_friends", "num_followers")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    NUM_FRIENDS_FIELD_NUMBER: _ClassVar[int]
    NUM_FOLLOWERS_FIELD_NUMBER: _ClassVar[int]
    user_id: _plib_pb2.pUUID
    num_friends: int
    num_followers: int
    def __init__(self, user_id: _Optional[_Union[_plib_pb2.pUUID, _Mapping]] = ..., num_friends: _Optional[int] = ..., num_followers: _Optional[int] = ...) -> None: ...
