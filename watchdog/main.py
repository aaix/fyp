import asyncio

from opentelemetry.trace import get_current_span

from watchdog.tracing import tracer

from shared.py.intraservice.discoverystore import DATASERVICES_SERVICE, GATEWAY_SERVICE
from shared.py.intraservice.discoverystore.client import BigPictureClient, BigPictureClientServiceFactory

dataservices_bigpicture = BigPictureClientServiceFactory(DATASERVICES_SERVICE)
gateway_bigpicture = BigPictureClientServiceFactory(GATEWAY_SERVICE)


CONF_NUM_PINGS = 10
CONF_PASS_RATE = 0.5

async def main():
    await dataservices_bigpicture.valkey_connect()
    await gateway_bigpicture.valkey_connect()

    services = (dataservices_bigpicture, gateway_bigpicture)

    while True:
        for service in services:
            # copy nodes so that nodes list isnt mutated while doing the check
            for node in tuple(service.ring.get_nodes()):
                if await perform_host_check(node):
                    continue
                # else: node failure detected
                await remove_node_from_picture(service, node)
        await asyncio.sleep(5)


@tracer.start_as_current_span("remove_node_from_picture")
async def remove_node_from_picture(service: BigPictureClient, node: str):
    span = get_current_span()
    span.set_attribute("az.watchdog.kick.service", str(service.member_set))
    span.set_attribute("az.watchdog.kick.node", str(node))

    await service.store.srem(service.member_set, [node])
    await service.store.publish(node, service.leave_channel)
    print(f"Kicked {node} from {service.member_set} due to keepalive fail")



async def perform_host_check(node: str):
    successes = 0
    for _ in range(CONF_NUM_PINGS):
        successes += await ping_once(node)
    
    is_alive = (successes / CONF_NUM_PINGS) > CONF_PASS_RATE

    return is_alive

async def ping_once(address: str) -> bool:
    """Ping a host, returning true on success"""
    # -c 1: 1 packet
    # -W 1: 1s timeout
    proc = await asyncio.create_subprocess_exec(
        'ping', '-c', '1', '-W', '1', address,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL
    )
    
    await proc.wait()
    return proc.returncode == 0

if __name__ == "__main__":
    asyncio.run(main())