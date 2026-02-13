
from pydantic import BaseModel


from api.utils import Base64Output


__all__ = (
    "LoginBody",
    "LoginResponse"
)



class LoginBody(BaseModel):
    username: str


class LoginResponse(BaseModel):
    encrypted_session: Base64Output

