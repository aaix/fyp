from typing import Any, Mapping

import json

from starlette.background import BackgroundTask
from starlette.responses import JSONResponse


from api.responses.status_codes import ERROR_UNKNOWN
from api.logger import log


class ApiErrExc(Exception):
    def __init__(self, res: ErrorResponse):
        super().__init__()
        self.res = res


class ApiResponse(JSONResponse):
    @staticmethod
    def __default_log(v: Any) -> str:
        log(f"Error serialising {v}")
        return "Unknown!"
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            default=self.__default_log
        ).encode("utf-8")

class SuccessResponse(ApiResponse):
    def render(self, content: object) -> bytes:
        return super().render({
            "success": True,
            "data":content
        })


class ErrorResponse(ApiResponse):
    API_CODE = ERROR_UNKNOWN
    HTTP_CODE = 0

    def __init__(self, message: str, *, structure: object = None, api_error_code: int | None = None, headers: Mapping[str, str] | None = None, media_type: str | None = None, background: BackgroundTask | None = None) -> None:
        self.custom_code = api_error_code
        self.custom_structure = structure
        assert self.HTTP_CODE
        super().__init__(message, self.HTTP_CODE, headers, media_type, background)
    def render(self, content: Any) -> bytes:
        return super().render({
            "success": False,
            "data": {
                "code": self.custom_code or self.API_CODE,
                "message": content,
                "structure": self.custom_structure
            }
        })
    
    