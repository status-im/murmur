const WS = require('libp2p-websockets');
const Bootstrap = require('libp2p-bootstrap');
const Multiplex = require('libp2p-mplex');
const SECIO = require('libp2p-secio');
const libp2p = require('libp2p');

const BOOTNODES = require('../data/config.json')['libp2p'].bootnodes;

class LibP2PBundle extends libp2p {
  constructor (peerInfo, bootnodes) {
    bootnodes = bootnodes && bootnodes.length ? bootnodes : [];
    if(BOOTNODES && BOOTNODES.length > 0){
      bootnodes = bootnodes.concat(BOOTNODES);
    }
    
    super({
      modules: {
        transport: [WS],
        streamMuxer: [Multiplex],
        connEncryption: [SECIO],
        peerDiscovery: [Bootstrap],
      },
      peerInfo,
      config: {
        peerDiscovery: {
          bootstrap: {
            interval: 2000,
            enabled: true,
            list: bootnodes
          }
        },
     
        EXPERIMENTAL: {
          dht: false,
          pubsub: false
        }
      }
    });
  }
}

module.exports = LibP2PBundle;
