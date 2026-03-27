import asyncio
import argparse
import ipaddress
import signal
import sys

from websockets.asyncio.server import serve

from gateway import log
from gateway.server import GatewayController

parser = argparse.ArgumentParser()

parser.add_argument("--port", type=int)
parser.add_argument("--host", type=ipaddress.ip_address)

args = parser.parse_args(sys.argv[1:])
host, port = str(args.host), args.port

log(f"Gateway on {host}:{port}")


async def main():
    loop = asyncio.get_running_loop()

    controller = GatewayController(loop)
    await controller.start()
    server_future = loop.create_future()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(
            sig,
            lambda: controller.shutdown(server_future)
        )


    log("Starting server")
    async with serve(controller.accept_incoming, host=host, port=port):
        await server_future
    log("No longer serving")
    await controller.shutdown_inner()


if __name__ == "__main__":
    asyncio.run(main())