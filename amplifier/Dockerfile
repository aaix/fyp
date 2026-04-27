# cargo chef stage
FROM rust:1.92.0-bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /az7

FROM chef AS planner
COPY . ./amplifier/
COPY --from=shared ./rs /az7/shared/rs/
COPY --from=root Cargo.lock .
COPY --from=root Cargo.toml .
RUN sed -i '/"mediaservices"/d' Cargo.toml
RUN sed -i '/"dataservices"/d' Cargo.toml
RUN cargo chef prepare --recipe-path recipe.json

# dependency builder
FROM chef AS cacher
ARG release="--release"
COPY --from=planner /az7/recipe.json recipe.json
RUN apt-get update && apt-get install -y protobuf-compiler gcc
RUN cargo chef cook ${release} --recipe-path recipe.json

# builder stage
FROM cacher AS builder
ARG release="--release"
COPY --from=planner /az7/recipe.json recipe.json
COPY --from=shared ./sharedproto /az7/shared/sharedproto/
RUN apt-get update && apt-get install -y protobuf-compiler gcc

COPY --from=shared ./rs /az7/shared/rs/
COPY . /az7/amplifier/

# compile time dependencies
RUN cargo build --manifest-path /az7/amplifier/Cargo.toml --offline ${release}


FROM debian:12.13-slim AS runtime
ARG mode=release
WORKDIR /az7

COPY --from=builder /az7/target/${mode}/amplifier /usr/local/bin/amplifier

ARG backtrace=0
ENV RUST_BACKTRACE=$backtrace

ENTRYPOINT ["amplifier"]