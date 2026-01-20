FROM rust:1.92.0-bookworm AS build
WORKDIR /build/az7/dataservices/

RUN apt-get update -y
RUN apt-get install protobuf-compiler gcc -y

COPY . .

RUN cargo build --release


FROM debian:12.13-slim AS runtime

COPY --from=build /build/az7/dataservices/target/release/dataservices /usr/local/bin/dataservices

ENTRYPOINT ["dataservices"]