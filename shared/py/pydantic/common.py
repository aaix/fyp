from typing import Annotated

from pydantic import Field, AfterValidator

from shared.py.constraints import *
from shared.py.pydantic.base64 import Base64Input, Base64Output


def str_is_printable_no_whitespace(string: str) -> str:
    if not string.isprintable():
        raise ValueError("Unprintable character in input")
    if ' ' in string:
        raise ValueError("Input must not contain whitespace")
    return string


type Username = Annotated[str, AfterValidator(str_is_printable_no_whitespace), Field(max_length=USERNAME_MAX_LENGTH, min_length=USERNAME_MIN_LENGTH)]
type DeviceName = Annotated[str, Field(max_length=DEVICE_NAME_MAX_LENGTH, min_length=DEVICE_NAME_MIN_LENGTH)]
type ChannelNameIn = Annotated[Base64Input, Field(max_length=CHANNEL_NAME_MAX_LENGTH, min_length=CHANNEL_NAME_MIN_LENGTH)]
type ChannelNameOut = Annotated[Base64Output, Field(max_length=CHANNEL_NAME_MAX_LENGTH, min_length=CHANNEL_NAME_MIN_LENGTH)]