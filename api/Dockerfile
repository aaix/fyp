FROM python:3.14.2-alpine3.23

RUN mkdir -p /az7/api/

COPY ./requirements.txt /az7/api/

RUN python3 -m pip install -r /az7/api/requirements.txt

COPY . /az7/api/

ENTRYPOINT [ "python3", "-m", "fastapi", "run", "/az7/api/main.py" ]