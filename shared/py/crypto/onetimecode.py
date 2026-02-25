from os import urandom

def generate() -> int:
    return int.from_bytes(urandom(3))