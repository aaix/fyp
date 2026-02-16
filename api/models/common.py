from typing import Annotated

from pydantic import Field


type Username = Annotated[str, Field(max_length=16, min_length=3)]