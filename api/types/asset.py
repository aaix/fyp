from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class Asset(BaseModel):
    asset_id: UUID
    bucket_id: UUID
    public: bool

class PublicAsset(Asset):
    public: bool = True

class PrivateAsset(Asset):
    public: bool = False