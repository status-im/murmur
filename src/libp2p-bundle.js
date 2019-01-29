const WebRTCStar = require('libp2p-webrtc-star');
const WebSockets = require('libp2p-websockets');
const WebSocketStar = require('libp2p-websocket-star');
const Bootstrap = require('libp2p-bootstrap');
const Multiplex = require('libp2p-mplex');
const SPDY = require('libp2p-spdy');
const SECIO = require('libp2p-secio');
const libp2p = require('libp2p');

const BOOTNODES = require('../data/config.json')['libp2p'].bootnodes;

class LibP2PBundle extends libp2p {
  constructor (peerInfo, isBrowser, bootnodes) {
    bootnodes = bootnodes && bootnodes.length ? bootnodes : [];
    if(BOOTNODES && BOOTNODES.length > 0){
      bootnodes = bootnodes.concat(BOOTNODES);
    }

    let wrtcStar;
    if(isBrowser){
      wrtcStar = new WebRTCStar({id: peerInfo.id});
    } else {
      const wrtc = require('wrtc');
      wrtcStar = new WebRTCStar({ id: peerInfo.id, wrtc: wrtc });
    }

    const wsstar = new WebSocketStar({ id: peerInfo.id });

    super({
      modules: {
        transport: [
          wrtcStar,
          WebSockets,
          wsstar
        ],
        streamMuxer: [Multiplex, SPDY],
        connEncryption: [SECIO],
        peerDiscovery: [
          wrtcStar.discovery,
          wsstar.discovery,
          Bootstrap
        ],
      },
      peerInfo,
      config: {
        peerDiscovery: {
          webRTCStar: {
            enabled: true
          },
          websocketStar: {
            enabled: true
          },
          bootstrap: {
            interval: 2000,
            enabled: true,
            list: bootnodes
          }
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: false
          }
        },
        EXPERIMENTAL: {
          dht: false,
          pubsub: false
        }
      },
      connectionManager: {
        maxPeers: 25
      }
    });
  }
}

module.exports = LibP2PBundle;
