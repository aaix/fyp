from api.responses import ErrorResponse
from api.responses.status_codes import *

class InternalServerError(ErrorResponse):
    API_CODE = ERROR_UNKNOWN
    HTTP_CODE = 500

class Unauthorized(ErrorResponse):
    API_CODE = ERROR_UNAUTHORIZED
    HTTP_CODE = 401

class Forbidden(ErrorResponse):
    API_CODE = ERROR_FORBIDDEN
    HTTP_CODE = 403

class BadRequest(ErrorResponse):
    API_CODE = ERROR_BAD_REQUEST
    HTTP_CODE = 400

class UnsupportedMediaType(ErrorResponse):
    API_CODE = ERROR_BAD_REQUEST
    HTTP_CODE = 415

class NotFound(ErrorResponse):
    API_CODE = ERROR_NOT_FOUND
    HTTP_CODE = 404