ARG BASE_IMAGE=az-shared-base:latest
FROM ${BASE_IMAGE}

RUN mkdir -p /az7/garbagecollector/

COPY ./requirements.txt /az7/garbagecollector/

RUN python3 -m pip install --no-cache-dir -r /az7/garbagecollector/requirements.txt


COPY --from=shared ./__init__.py /az7/shared/
COPY --from=shared ./py /az7/shared/py

COPY . /az7/garbagecollector/

RUN mkdir -p /az7/garbagecollector/


RUN chmod +x /az7/garbagecollector/entrypoint.sh

ENTRYPOINT [ "/az7/garbagecollector/entrypoint.sh" ]
