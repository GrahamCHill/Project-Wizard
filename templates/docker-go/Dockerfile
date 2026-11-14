FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod *.go ./
RUN go test ./... && CGO_ENABLED=0 go build -trimpath -o /out/app .

FROM alpine:3.23
RUN printf '%s\n' '#!/bin/sh' 'exec wget -q -O /dev/null http://127.0.0.1:8080/healthz' > /usr/local/bin/healthcheck \
    && chmod 755 /usr/local/bin/healthcheck
COPY --from=build /out/app /usr/local/bin/app
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/app"]
