from typing import Annotated

from pydantic import Field

from shared.py.constraints import USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH


type Username = Annotated[str, Field(max_length=USERNAME_MAX_LENGTH, min_length=USERNAME_MIN_LENGTH)]