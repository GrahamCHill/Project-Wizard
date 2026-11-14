FROM rust:1.98-alpine AS build
RUN apk add --no-cache musl-dev
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM alpine:3.23
RUN printf '%s\n' '#!/bin/sh' 'exec wget -q -O /dev/null http://127.0.0.1:8080/healthz' > /usr/local/bin/healthcheck \
    && chmod 755 /usr/local/bin/healthcheck
COPY --from=build /src/target/release/app /usr/local/bin/app
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/app"]
