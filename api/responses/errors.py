from api.responses import ErrorResponse
from api.responses.status_codes import *

class Unauthorized(ErrorResponse):
    API_CODE = ERROR_UNAUTHORIZED
    HTTP_CODE = 401