from os import environ

from threading import Lock

from typing import Self

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
    
    def is_prod(self) -> bool:
        return environ.get("DEPLOYMENT_MODE", "dev") == "prod"