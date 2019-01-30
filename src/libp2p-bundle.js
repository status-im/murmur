const WebRTCStar = require('libp2p-webrtc-star');
const WebSockets = require('libp2p-websockets');
const WebSocketStar = require('libp2p-websocket-star');
const Bootstrap = require('libp2p-bootstrap');
const Multiplex = require('libp2p-mplex');
const SPDY = require('libp2p-spdy');
const SECIO = require('libp2p-secio');
const libp2p = require('libp2p');
// const WebSocketStarMulti = require('libp2p-websocket-star-multi');

const data = require('../data/config.json');
const BOOTNODES = data['libp2p'].bootnodes;
const SIGNALSERVERS = data['libp2p'].signalServers;

class LibP2PBundle extends libp2p {
  constructor (peerInfo, options) {
    let startWRTC = !!options.startWRTC;
    let signalServers = options.signalServers && options.signalServers.length ? options.signalServers : [];
    if(!signalServers.length) signalServers = SIGNALSERVERS && SIGNALSERVERS.length ? SIGNALSERVERS : [];

    let bootnodes = options.bootnodes && options.bootnodes.length ? options.bootnodes : [];
    if(!bootnodes.length) bootnodes = BOOTNODES && BOOTNODES.length ? BOOTNODES : [];

    let wrtcStar;
    if(startWRTC){
      const wrtc = require('wrtc');
      wrtcStar = new WebRTCStar({ id: peerInfo.id, wrtc: wrtc });
    } else {
      wrtcStar = new WebRTCStar({id: peerInfo.id});
    }

    signalServers.map(addr => {
      const ma = addr + "/ipfs/" +  peerInfo.id.toB58String();
      peerInfo.multiaddrs.add(ma);
    });
    
    // TODO: this should work with a single WRTC servers
    const wsstar = new WebSocketStar({ id: peerInfo.id });


    // TODO: this should work with multiple WRTC servers
    /*const wsstar = new WebSocketStarMulti({ 
      servers: signalServers, 
      id: peerInfo.id, 
      ignore_no_online: true
    });*/

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
            interval: 10000,
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
        maxPeers: 15
      }
    });
  }
}

module.exports = LibP2PBundle;
