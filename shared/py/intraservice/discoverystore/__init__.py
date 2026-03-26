from typing import Final, Literal, LiteralString
from dataclasses import dataclass


@dataclass
class BigPictureService:
    join_channel: LiteralString
    leave_channel: LiteralString
    state_set: LiteralString


GATEWAY_SERVICE = BigPictureService("gateway.join", "gateway.leave", "gateway.members")
DATASERVICES_SERVICE = BigPictureService("dataservices.join", "dataservices.leave", "dataservices.members")