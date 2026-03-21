from os import environ


from shared.py.types import SingletonMixin

class DiscoveryManager(SingletonMixin):
    """
    Handles discovery of variables, secrets and services
    """

    def __init__(self): ...

    def discover_valkey(self) -> tuple[str, int]:
        host, port = environ["VALKEY_URI"].split(":", 1)

        return host, int(port)

    def discover_dataservices(self) -> str:
        return environ["DATASERVICES_URI"]
    
    def discover_mediaservices(self) -> str:
        return environ["MEDIASERVICES_URI"]

    def discover_otel(self) -> str:
        return environ["OTEL_URI"]

    def find_s3_creds(self) -> tuple[str, str, str]:
        return (environ["S3_ENDPOINT_URL"], self.find_key("S3_ACCESS_KEY_ID"), self.find_key("S3_ACCESS_KEY_SECRET"))
    
    def find_s3_buckets(self) -> tuple[str, str]:
        return (environ["S3_PUBLIC_BUCKET"], environ["S3_PRIVATE_BUCKET"])
    
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