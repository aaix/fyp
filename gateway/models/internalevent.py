from uuid import UUID

from pydantic import BaseModel


class InternalEvent(BaseModel):
    recipient: UUID
