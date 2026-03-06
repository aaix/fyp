from typing import Annotated

from pydantic import Field, AfterValidator, ValidationError

from shared.py.constraints import DEVICE_NAME_MAX_LENGTH, DEVICE_NAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH


def str_is_printable_no_whitespace(string: str) -> str:
    if not string.isprintable():
        raise ValidationError("Unprintable character in input")
    if ' ' in string:
        raise ValidationError("Input must not contain whitespace")
    return string


type Username = Annotated[str,AfterValidator(str_is_printable_no_whitespace), Field(max_length=USERNAME_MAX_LENGTH, min_length=USERNAME_MIN_LENGTH)]
type DeviceName = Annotated[str, AfterValidator(str_is_printable_no_whitespace), Field(max_length=DEVICE_NAME_MAX_LENGTH, min_length=DEVICE_NAME_MIN_LENGTH)]