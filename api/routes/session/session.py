from fastapi import APIRouter, Request


from api.grpc.lazy import LazyGRPC
from api.grpcgen import user_pb2_grpc
from api.grpcgen import user_pb2
from api.discovery import DiscoveryManager

discovery = DiscoveryManager()

SessionRouter = APIRouter()


grpcuser = LazyGRPC(discovery.discover_dataservices(), user_pb2_grpc.UserServiceStub)


@SessionRouter.post("/new")
def sessionnew(): ...