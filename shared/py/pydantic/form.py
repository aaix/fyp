from typing import Annotated, Any

import inspect

from fastapi import Form
from pydantic import BaseModel



class _FromForm[T]:
    def __init__(self, factory: type[T], signature: inspect.Signature):
        self.__signature__ = signature
        self.factory = factory
    
    def __call__(self, **kwargs) -> T:
        return self.factory(**kwargs)


class FormableBaseModel(BaseModel):
    """Class that will populate as form"""

    @classmethod
    def __pydantic_init_subclass__(cls, **kwargs: Any):
        fields = cls.model_fields

        new_fields = []
        for name, info in fields.items():
            annotation = Annotated[info.annotation, Form()]
            new_fields.append(inspect.Parameter(
                name,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
                default=info.default,
                annotation=annotation,
            ))

        def from_form(**kwargs):
            return cls(**kwargs)

        # Overwrite the signature of our wrapper so FastAPI sees the Form fields
        sig = inspect.signature(from_form)
        sig = sig.replace(parameters=new_fields)
        cls.from_form = _FromForm(cls, sig)

