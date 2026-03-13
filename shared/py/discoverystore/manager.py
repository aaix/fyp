from os import environ


from shared.py.types import SingletonMixin

class DiscoveryManager(SingletonMixin):
    """
    Handles discovery of variables & secrets as well as building a picture
    of the distributed system as a whole for persistent routing
    """


    def __init__(self): ...

    def discover_valkey(self) -> tuple[str, int]:
        host, port = environ["VALKEY_URI"].split(":", 1)

        return host, int(port)

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