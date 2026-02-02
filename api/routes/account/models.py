
from pydantic import BaseModel, Field

from api.crypto.models import PEMPublicKey

from typing import Annotated


__all__ = (
    "SignupBody",
    "SignupResponse",
)



class SignupBody(BaseModel):
    username: Annotated[str, Field(max_length=16, min_length=3)]
    email: Annotated[str, Field(min_length=6, max_length=64)]
    public_key: PEMPublicKey


class SignupResponse(BaseModel):
    user_id: str
    username: str
    email: str
    public_key: PEMPublicKey
    avatar_asset_id: str | None

