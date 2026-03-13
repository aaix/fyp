from typing import Never

import socket

from gateway.models.exceptions import InternalError


def unwrap() -> Never:
    raise InternalError()

def get_current_node_ip():
    hostname = socket.gethostname()
    ip_address = socket.gethostbyname(hostname)
    return ip_address