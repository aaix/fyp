import grpc
from google.auth.compute_engine import IDTokenCredentials
from google.auth.transport.grpc import AuthMetadataPlugin
from google.auth.transport.requests import Request

from os import environ


from shared.py.types import SingletonMixin

class DiscoveryManager(SingletonMixin):
    """
    Handles discovery of variables, secrets and services
    """

    def __init__(self):
        self._is_prod: bool | None = None

    def discover_valkey(self) -> tuple[str, int]:
        host, port = environ["VALKEY_URI"].split(":", 1)

        return host, int(port)
    
    def discover_mediaservices(self) -> str:
        return environ["MEDIASERVICES_URI"]
    
    def mediaservices_auth(self) -> grpc.CallCredentials | None:
        if not self.is_prod():
            return None
        
        audience = "https://" + self.discover_mediaservices().split(":", 1)[0]
        creds = IDTokenCredentials(Request(), target_audience=audience)
        plugin = AuthMetadataPlugin(creds, Request())

        return grpc.metadata_call_credentials(plugin)

    def discover_otel(self) -> str:
        return environ["OTEL_URI"]
    
    def transform_gateway_to_external(self, gateway: str) -> str:
        if self.is_prod():
            return "/gateway"
        return f"/gateway?g={gateway}"

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
        if self._is_prod is None:
            self._is_prod = environ.get("DEPLOYMENT_MODE", "dev") == "prod"
        return self._is_prod