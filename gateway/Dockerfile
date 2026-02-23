FROM python:3.14.2-alpine3.23

RUN mkdir -p /az7/api/

COPY ./requirements.txt /az7/gateway/

RUN python3 -m pip install -r /az7/gateway/requirements.txt

COPY --from=shared . /az7/shared/

COPY . /az7/gateway/

RUN chmod +x /az7/gateway/entrypoint.sh

ENTRYPOINT [ "/az7/gateway/entrypoint.sh" ]