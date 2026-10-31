FROM alpine:3.20
RUN apk add --no-cache g++ musl-dev
USER 65534:65534