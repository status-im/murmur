const Mplex = require('libp2p-mplex');
const SECIO = require('libp2p-secio');
const Bootstrap = require('libp2p-bootstrap');
const libp2p = require('libp2p');
const KadDHT = require('libp2p-kad-dht');
const MulticastDNS = require('libp2p-mdns')


const TCP = require('libp2p-tcp');
const WS = require('libp2p-websockets');

class LibP2PBundle extends libp2p {
  constructor (peerInfo) {
    super({
      modules: {
        transport: [
          TCP,
          WS
        ],
        streamMuxer: [Mplex],
        connEncryption: [SECIO],
        peerDiscovery: [Bootstrap, MulticastDNS],
        dht: KadDHT
      },
      peerInfo,
      config: {
        peerDiscovery: {
          bootstrap: {
            interval: 2000,
            enabled: false,
            list: []
          }
        },
        dht: {
          kBucketSize: 20
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
