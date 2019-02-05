#!/usr/bin/env sh

node /app/bin/murmur \
  --wsport ${WS_RPC_PORT} \
  --devp2p-port ${DEV_P2P_PORT} \
  --libp2p-port ${LIB_P2P_PORT} \
  ${CUSTOM_OPTIONS}
