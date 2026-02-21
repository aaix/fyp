FROM python:3.14.2-alpine3.23

RUN mkdir -p /az7/api/

COPY ./requirements.txt /az7/api/

RUN python3 -m pip install -r /az7/api/requirements.txt

COPY --from=dataservicesgrpc . /az7/dataservicesgrpc/

COPY . /az7/api/

RUN chmod +x /az7/api/entrypoint.sh

ENTRYPOINT [ "/az7/api/entrypoint.sh" ]