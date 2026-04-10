ARG BASE_IMAGE=az-shared-base:latest
FROM ${BASE_IMAGE}

RUN apt-get update && apt-get install -y iputils-ping


RUN mkdir -p /az7/watchdog/

COPY ./requirements.txt /az7/watchdog/


RUN python3 -m pip install --no-cache-dir -r /az7/watchdog/requirements.txt


COPY --from=shared ./__init__.py /az7/shared/
COPY --from=shared ./py /az7/shared/py


COPY . /az7/watchdog/


RUN chmod +x /az7/watchdog/entrypoint.sh

ENTRYPOINT [ "/az7/watchdog/entrypoint.sh" ]
