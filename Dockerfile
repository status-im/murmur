FROM node:10.15-alpine

ENV WS_RPC_PORT=8546 \
    DEV_P2P_PORT=30303 \
    LIB_P2P_PORT=0 \
    CUSTOM_OPTIONS=''

WORKDIR /app

COPY . /app

RUN apk update \
 && apk add --no-cache git python make g++ \
 && yarn install --prod --ignore-optional && yarn cache clean \
 && apk del git python make g++

LABEL source="https://github.com/status-im/murmur" \
      description="Whisper node / client implementation built in javascript" \
      maintainer="richard@status.im"

CMD ["/app/bin/run.sh"]
EXPOSE $DEV_P2P_PORT
