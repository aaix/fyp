from garbagecollector.tracing import tracer
from shared.py.asset import delete_asset, delete_many_assets
from shared.py.grpc.channel import delete_channel, get_channel
from shared.py.grpc.gc import delete_garbage
from shared.py.grpc.id import id_t, puuid_opt
from shared.py.grpc.lazy import DataservicesLazyGRPC
from shared.py.grpc.message import delete_messages_in_bucket, read_messages
from shared.py.grpcgen import channel_pb2_grpc, gc_pb2_grpc, message_pb2_grpc

grpcmessage = DataservicesLazyGRPC(message_pb2_grpc.MessageServiceStub)
grpcchannel = DataservicesLazyGRPC(channel_pb2_grpc.ChannelServiceStub)
grpcgarbage = DataservicesLazyGRPC(gc_pb2_grpc.GarbageServiceStub)


@tracer.start_as_current_span("process_channel")
async def process_channel(bucket: int, channel_id: id_t):
    channel = await get_channel(grpcchannel, channel_id)

    if puuid_opt(channel.opt_channel_icon_asset_id):
        await delete_asset(public=False, bucket_id=channel.channel_id, asset_id=channel.opt_channel_icon_asset_id)

    rpc = await read_messages(grpcmessage, channel_id, None, 500, latest_bucket=channel.latest_bucket)
    messages = rpc.messages

    asset_ids = []
    current_max_bucket = -1

    while len(messages) > 0:
        current_max_bucket = messages[0].bucket
        before = messages[-1].message_id

        for message in messages:
            if message.bucket != current_max_bucket:
                if len(asset_ids) > 0:
                    await delete_many_assets(public=False, bucket_id=channel_id, asset_ids=asset_ids)
                    asset_ids.clear()

                await delete_messages_in_bucket(grpcmessage, channel_id, current_max_bucket)
                current_max_bucket = message.bucket

            elif len(asset_ids) == 1000:
                await delete_many_assets(public=False, bucket_id=channel_id, asset_ids=asset_ids)
                asset_ids.clear()
            
            if puuid_opt(message.opt_attachment_asset_id):
                asset_ids.append(message.opt_attachment_asset_id)
            
        

        rpc = await read_messages(grpcmessage, channel_id, before, 500, latest_bucket=current_max_bucket)
        messages = rpc.messages
    
    if len(asset_ids) > 0:
        await delete_many_assets(public=False, bucket_id=channel_id, asset_ids=asset_ids)

    if current_max_bucket >= 0:
        await delete_messages_in_bucket(grpcmessage, channel_id, current_max_bucket)

    await delete_channel(grpcchannel, channel_id)
    await delete_garbage(grpcgarbage, bucket, channel_id)

    
