from typing import Self

from os import environ
from threading import Lock


class DiscoveryManager:
    __discovery_manager = None
    __lock = Lock()
    def __new__(cls) -> Self:
        if cls.__discovery_manager is not None:
            return cls.__discovery_manager

        with cls.__lock:
            if cls.__discovery_manager is None:
                cls.__discovery_manager = super().__new__(cls)
            else:
                # we raced
                assert cls.__discovery_manager
        return cls.__discovery_manager

    def __init__(self): ...

    def discover_dataservices(self) -> str:
        return environ["DATASERVICES_URI"]
    
    def discover_otel(self) -> str:
        return environ["OTEL_URI"]
    
    def find_key(self, key_name: str) -> str:
        try:
            return environ[key_name]
        except KeyError:
            return self.find_secret(f"{key_name}".lower())
    
    def find_secret(self, secret: str) -> str:
        with open(f"/secrets/{secret}") as f:
            return f.read()


    def is_prod(self) -> bool:
        return environ.get("DEPLOYMENT_MODE", "dev") == "prod"