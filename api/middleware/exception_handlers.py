from fastapi import Request, Response
from fastapi.exceptions import RequestValidationError 

from api import ApiErrExc
from api.responses.errors import BadRequest

def api_err_exc_error_handler(request: Request, exc: Exception) -> Response:
    assert isinstance(exc, ApiErrExc)
    return exc.res

def request_validation_error_handler(request: Request, exc: Exception) -> Response:
    assert isinstance(exc, RequestValidationError)
    return BadRequest("Invalid request data", exc.errors())