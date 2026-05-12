FROM python:3.14-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive

# clang and llvm required for the jit templating
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    libssl-dev \
    zlib1g-dev \
    libncurses5-dev \
    libgdbm-dev \
    libnss3-dev \
    libsqlite3-dev \
    libreadline-dev \
    libffi-dev \
    libbz2-dev \
    pkg-config \
    clang \
    llvm \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHON_VERSION=3.14.4

WORKDIR /usr/src/python
RUN curl -fSL "https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tar.xz" -o python.tar.xz \
    && tar -xvf python.tar.xz --strip-components=1


RUN ./configure \
    --enable-experimental-jit \
    --enable-optimizations \
    --with-lto \
    --prefix=/opt/python3.14 \
    && make -j$(nproc) \
    && make install

CMD ["python3", "-c", "import sys; print(f'BUILT PYTHON {sys.version}')"]


FROM debian:stable-slim

COPY --from=builder /opt/python3.14 /opt/python3.14

ENV PATH="/opt/python3.14/bin:$PATH"

# TODO: this is massive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    libssl-dev \
    zlib1g-dev \
    libncurses5-dev \
    libgdbm-dev \
    libnss3-dev \
    libsqlite3-dev \
    libreadline-dev \
    libffi-dev \
    libbz2-dev \
    && rm -rf /var/cache/apt

RUN mkdir -p /az7/shared/

COPY ./py/requirements.txt /az7/shared/requirements.txt

RUN python3 -m pip install --no-cache-dir -r /az7/shared/requirements.txt
