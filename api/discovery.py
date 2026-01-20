from os import environ

from typing import Self

class DiscoveryManager:
    __discovery_manager = None
    def __new__(cls) -> Self:
        if cls.__discovery_manager is None:
            cls.__discovery_manager = super().__new__(cls)
        return cls.__discovery_manager

    def __init__(self): ...

    def discover_dataservices(self) -> str:
        return environ["DATASERVICES_URI"]