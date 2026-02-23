import typing

import grpc



class _GRPCStub(typing.Protocol):
    def __init__(self, channel): ...


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
        return grpc.aio.insecure_channel(self.factory_uri)



    