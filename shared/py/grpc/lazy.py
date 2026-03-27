from collections import defaultdict
from collections.abc import Awaitable
import typing

import uuid

import grpc

from shared.py.grpc.id import id_t, id_uuid
from shared.py.intraservice.discoverystore import DATASERVICES_SERVICE
from shared.py.intraservice.discoverystore.client import BigPictureClient, BigPictureClientServiceFactory
from shared.py.types import KeyedDefaultDict

dataservices_bigpicture = BigPictureClientServiceFactory(DATASERVICES_SERVICE)

class _GRPCStub(typing.Protocol):
    def __init__(self, channel: grpc.aio.Channel): ...


async def lazy_init():
    await dataservices_bigpicture.valkey_connect()


class LazyGRPC[T: _GRPCStub]:
    """Helper to lazily create grpc channels to avoid
    creating them before the main event loop is created"""
    def __init__(self, uri: str, stub: type[T]):
        self.factory_uri = uri
        self.factory_stub = stub

        self._channel: None | grpc.aio.Channel = None
        self._stub: None | T = None
    
    @property
    def stub(self) -> T:
        if self._stub is None:
            self._stub = self.factory_stub(self.channel)
            assert self._stub is not None
        return self._stub
        
    @property
    def channel(self) -> grpc.aio.Channel:
        if self._channel is None:
            self._channel = grpc.aio.insecure_channel(self.factory_uri)
            assert self._channel is not None
        return self._channel






class _DynamicLazyGRPC[T: _GRPCStub]:
    """Like lazygrpc but can specify a bucket for dynamic routing"""

    BIG_PICTURE: BigPictureClient
    PORT: int

    def __init__(self, stub: type[T]):
        self.stub_type = stub

        self._channel: None | grpc.aio.Channel = None
        self._stubs: dict[str, T] = KeyedDefaultDict(self.stub_factory)

    async def __call__(self, bucket: id_t | None = None) -> T:
        return await self._stub(bucket)

    def stub_factory(self, remote: str) -> T:
        channel = grpc.aio.insecure_channel(f"{remote}:{self.PORT}")
        return self.stub_type(channel)

    
    async def _stub(self, bucket: id_t | None) -> T:
        key = await self._bucket_to_remote(bucket)
        return self._stubs[key]


    async def _bucket_to_remote(self, bucket: id_t | None) -> str:
        # use a random key if we dont need persistent routing
        key = id_uuid(bucket) or uuid.uuid4() if bucket else uuid.uuid4()
        return await self.BIG_PICTURE.get_node(key)
        
class DataservicesLazyGRPC[T: _GRPCStub](_DynamicLazyGRPC[T]):
    BIG_PICTURE = dataservices_bigpicture
    PORT = 3114