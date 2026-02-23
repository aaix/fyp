from pydantic import BaseModel


from shared.py.pydantic.base64 import Base64Output


__all__ = (
    "LoginBody",
    "LoginResponse"
)



class LoginBody(BaseModel):
    username: str


class LoginResponse(BaseModel):
    encrypted_session: Base64Output

