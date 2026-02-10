
from pydantic import BaseModel, Base64Bytes


from typing import Annotated


__all__ = (
    "LoginBody",
    "LoginResponse"
)



class LoginBody(BaseModel):
    username: str


class LoginResponse(BaseModel):
    encrypted_session: Base64Bytes

