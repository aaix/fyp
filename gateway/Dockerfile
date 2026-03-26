ARG BASE_IMAGE=az-shared-base:latest
FROM ${BASE_IMAGE}

RUN mkdir -p /az7/gateway/

COPY ./requirements.txt /az7/gateway/

RUN python3 -m pip install --no-cache-dir -r /az7/gateway/requirements.txt


COPY --from=shared ./__init__.py /az7/shared/
COPY --from=shared ./py /az7/shared/py

COPY . /az7/gateway/

RUN mkdir -p /az7/gateway/


RUN chmod +x /az7/gateway/entrypoint.sh

ENTRYPOINT [ "/az7/gateway/entrypoint.sh" ]
