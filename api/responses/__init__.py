from starlette.background import BackgroundTask
from starlette.responses import JSONResponse

from typing import Any, Mapping

from api.responses.status_codes import ERROR_UNKNOWN

class ApiResponse(JSONResponse): ...
class SuccessResponse(ApiResponse):
    def render(self, content: object) -> bytes:
        return super().render({
            "success": True,
            "data":content
        })


class ErrorResponse(ApiResponse):
    API_CODE = ERROR_UNKNOWN
    HTTP_CODE = 0

    def __init__(self, message: str, api_error_code: int | None = None, headers: Mapping[str, str] | None = None, media_type: str | None = None, background: BackgroundTask | None = None) -> None:
        self.custom_code = api_error_code
        assert self.HTTP_CODE
        super().__init__(message, self.HTTP_CODE, headers, media_type, background)
    def render(self, content: Any) -> bytes:
        return super().render({
            "success": False,
            "data": {
                "code": self.custom_code or self.API_CODE,
                "message": content
            }
        })
    
    