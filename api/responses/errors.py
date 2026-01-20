from api.responses import ErrorResponse
from api.responses.status_codes import *

class Unauthorized(ErrorResponse):
    API_CODE = ERROR_UNAUTHORIZED
    HTTP_CODE = 401

class BadRequest(ErrorResponse):
    API_CODE = ERROR_BAD_REQUEST
    HTTP_CODE = 400

class UnsupportedMediaType(ErrorResponse):
    API_CODE = ERROR_BAD_REQUEST
    HTTP_CODE = 415