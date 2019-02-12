const EventEmitter = require('events').EventEmitter;
const assert = require('assert');
const pull = require('pull-stream');
const drain = require('pull-stream/sinks/drain');

const PROTOCOL = "/whisper/gossip/1.0.0/dev-v1";

class LibP2PGossip extends EventEmitter {

  constructor (options) {
    super();
    assert(options.peerInfo, 'needs a PeerInfo to work');

    this.peerInfo = options.peerInfo;
    this.broadcastInterval = null; 
  }

  setNode(node){
    this.node = node;
    this.node.peers = [];
  }

  start (callback) {
    const self = this;

    this.node.handle(PROTOCOL, (protocol, conn) => {
      pull(conn,
        pull.map((v) => v.toString()),
        drain(message => {
          // Receive peers
          const peers = JSON.parse(message);
          
          // TODO: determine if peers are new
          // If peers are new, add them to list and dial
          // self.emit('peer',  new foundPeer)

        })
      );
    });

    this._broadcastPeers();
    
    setImmediate(() => callback());
  }

  _broadcastPeers () {

  }

  stop (callback) {
    // Stop broadcast interval
    callback();
  }
}

module.exports = LibP2PGossip;
