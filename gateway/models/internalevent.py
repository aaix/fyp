from typing import Any

from dataclasses import dataclass

from opentelemetry.trace import Span



@dataclass(kw_only=True)
class InternalEvent:
    span: Span
    oneof: str
    payload: Any
