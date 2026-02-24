import asyncio
import argparse
import ipaddress
import signal
import sys

from websockets.asyncio.server import serve

from gateway.server import GatewayController

parser = argparse.ArgumentParser()

parser.add_argument("--port", type=int)
parser.add_argument("--host", type=ipaddress.ip_address)

args = parser.parse_args(sys.argv[1:])
host, port = str(args.host), args.port

print(f"Gateway on {host}:{port}", flush=True)


async def main():
    loop = asyncio.get_running_loop()

    controller = GatewayController()
    server_future = loop.create_future()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(
            sig,
            lambda: controller.shutdown(loop, server_future)
        )


    print("Starting server", flush=True)
    async with serve(controller.accept_incoming, host=host, port=port) as server:
        await server_future


if __name__ == "__main__":
    asyncio.run(main())