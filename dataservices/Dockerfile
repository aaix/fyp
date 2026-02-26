# cargo chef stage
FROM rust:1.92.0-bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# dependency builder
FROM chef AS cacher
COPY --from=planner /app/recipe.json recipe.json
RUN apt-get update && apt-get install -y protobuf-compiler gcc
RUN cargo chef cook --release --recipe-path recipe.json

# builder stage
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json

# precompiled dependencies
COPY --from=cacher /app/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
COPY . .

# compile time dependencies
RUN apt-get update && apt-get install -y protobuf-compiler gcc
RUN cargo build --release


FROM debian:12.13-slim AS runtime
WORKDIR /app

COPY --from=builder /app/target/release/dataservices /usr/local/bin/dataservices

ENTRYPOINT ["dataservices"]