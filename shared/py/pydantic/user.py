from collections.abc import Callable
from typing import Never
from uuid import UUID

from pydantic import BaseModel

from shared.py.grpc.id import puuid_uuid
from shared.py.grpcgen import user_pb2
from shared.py.pydantic.pem import PEMPublicKey


class UserSearchResponse(BaseModel):
    user_id: UUID
    avatar_asset_id: UUID | None
    public_key: PEMPublicKey
    username: str

    @classmethod
    def from_rpc(cls, res: user_pb2.UserSearchEntry):

        # use assert for type cooersion for sharing  
        u_id = puuid_uuid(res.user_id)
        assert u_id is not None

        return cls(
            user_id=u_id,
            avatar_asset_id=puuid_uuid(res.opt_avatar_asset_id),
            public_key=PEMPublicKey.from_bytes(res.public_key),
            username=res.username,
        )