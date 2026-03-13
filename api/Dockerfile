FROM az-shared-base:latest

RUN mkdir -p /az7/api/

COPY ./requirements.txt /az7/api/

RUN python3 -m pip install --no-cache-dir -r /az7/api/requirements.txt


COPY --from=shared . /az7/shared/

COPY . /az7/api/

RUN mkdir -p /az7/api/


RUN chmod +x /az7/api/entrypoint.sh

ENTRYPOINT [ "/az7/api/entrypoint.sh" ]
