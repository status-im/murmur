const WebSockets = require('libp2p-websockets');
const Bootstrap = require('libp2p-bootstrap');
const Multiplex = require('libp2p-mplex');
const SPDY = require('libp2p-spdy');
const SECIO = require('libp2p-secio');
const libp2p = require('libp2p');
const KadDHT = require('libp2p-kad-dht');

const data = require('../data/config.json');

const BOOTNODES = data['libp2p'].bootnodes;

class LibP2PBundle extends libp2p {
  constructor (peerInfo, options) {
    let bootnodes = options.bootnodes && options.bootnodes.length ? options.bootnodes : [];
    if(!bootnodes.length) bootnodes = BOOTNODES && BOOTNODES.length ? BOOTNODES : [];
    
//bootnodes = [];

    const ma = "/ip4/0.0.0.0/tcp/0/ws/ipfs/" +  peerInfo.id.toB58String();
    peerInfo.multiaddrs.add(ma);

    super({
      modules: {
        transport: [WebSockets],
        streamMuxer: [Multiplex, SPDY],
        connEncryption: [SECIO],
        peerDiscovery: [Bootstrap],
        dht: KadDHT
      },
      
      peerInfo,
      config: {
        peerDiscovery: {
          bootstrap: {
            interval: 10000,
            enabled: true,
            list: bootnodes
          }
        },
        dht: {
          enabledDiscovery: true
        },
        EXPERIMENTAL: {
          dht: true
        }
      },
      connectionManager: {
        maxPeers: 15
      }
      
    });
  }
}

module.exports = LibP2PBundle;
