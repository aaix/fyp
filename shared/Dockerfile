FROM python:3.14.2-slim

RUN mkdir -p /az7/shared/

COPY ./py/requirements.txt /az7/shared/requirements.txt

RUN python3 -m pip install --no-cache-dir -r /az7/shared/requirements.txt
