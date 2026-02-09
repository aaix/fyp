from fastapi import Request, Response
from fastapi.exceptions import RequestValidationError 

from api import ApiErrExc
from api.responses import errors, status_codes as code

def api_err_exc_error_handler(request: Request, exc: Exception) -> Response:
    assert isinstance(exc, ApiErrExc)
    return exc.res

def request_validation_error_handler(request: Request, exc: Exception) -> Response:
    assert isinstance(exc, RequestValidationError)
    return errors.BadRequest("Invalid request data", structure=exc.errors())

def unhandled_exception_handler(request: Request, exc: Exception) -> Response:
    return errors.InternalServerError("Unexpected error occurred")

def not_found_exception_handler(request: Request, exc: Exception) -> Response:
    return errors.NotFound("No such route exists", api_error_code=code.ERROR_NO_SUCH_ROUTE)