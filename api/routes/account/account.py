from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, Base64Bytes

from typing import Annotated

AccountRouter = APIRouter()


class SignupBody(BaseModel):
    username: Annotated[str, Field(max_length=16, min_length=3)]
    email: Annotated[str, Field(min_length=6, max_length=64)]
    public_key: Base64Bytes



@AccountRouter.post("/signup")
async def signup(request: Request, body: SignupBody):
    return {"user": body.username, "key":body.public_key.hex()}