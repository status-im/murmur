const LibP2PBundle = require('./libp2p-bundle');
const PeerInfo = require('peer-info');
const chalk = require('chalk');
const pull = require('pull-stream');
const drain = require('pull-stream/sinks/drain');
const rlp = require('rlp-encoding');
const Events = require('events');
const {keccak256} = require("eth-lib/lib/hash");

let p2pNode;

const libP2Phandler = (err) => {
  if (err) { throw err; }
  console.log(chalk.yellow(`* libP2P started: ${p2pNode.isStarted()}, listening on:`));
  p2pNode.peerInfo.multiaddrs.forEach((ma) => console.log(chalk.yellow("- " + ma.toString())));
};

const createNode = (address, self) => {
  return new Promise(function(resolve, reject) {
    PeerInfo.create((err, peerInfo) => {
      if(err) {
        reject(err);
      }

      peerInfo.multiaddrs.add(address);
      p2pNode = new LibP2PBundle(peerInfo);     
      p2pNode.old_start = p2pNode.start;
      p2pNode.start = () => {
        p2pNode.old_start(libP2Phandler);
      };

      p2pNode.handle('/shh', (protocol, conn) => {
        pull(conn,
          pull.map((v) => rlp.decode(Buffer.from(v.toString(), 'hex'))),
          drain(messages => {
            conn.getPeerInfo((err, peerInfo) => {

            
            // TODO: Repeated code with devp2p. Abstract this
            // Abstraction must take in account if message id is received from what protocol
            // and determine if it's really duplicated or not.)
            const message = messages[0];

            if(self.tracker.exists(message, 'libp2p')) return;

            let [expiry, ttl, topic, data, nonce] = message[0]; // TODO: Refactor with function to obtain data object


            // TODO: for mailservers, inspect peer
            // Verifying if old message is sent by trusted peer by inspecting peerInfo.multiaddrs
            /*if(self.isTooOld(expiry) && !PEER_IS_TRUSTED){
              // console.log("Discarting old envelope");
              return;
            }*/
            if(Buffer.isBuffer(topic) && topic.toString('hex') == "27ee704f")
            console.log("Receiving message on libp2p")


            self.tracker.push(message, 'libp2p');

            // Broadcast received message again.
            self.broadcast(rlp.encode(messages));

            self.events.emit('shh_message', message);
            });
          })
        );
      });
      
      resolve(p2pNode);
    });
  });
};


class LibP2PNode {
    constructor(options){
      if(!options) options = {};
      this.privateKey = options.privateKey;
      this.bootnodes = options.bootnodes || [];
      this.staticnodes = options.staticnodes || [];
      this.trustedPeers = [];
      this.events = new Events();
      this.messagesTracker = {};
      this.peers = {};
      this.type = "libp2p";
      this.tracker = null;
    }

    setTracker(tracker){
      this.tracker = tracker;
    }

    async start(ip, port){
      if(!ip) ip = "0.0.0.0";
      if(!port) port = "0";
      const address =  `/ip4/${ip}/tcp/${port}`;
      this.node = await createNode(address, this);
      this.node.start();

      this._startDiscovery();
    }

  _startDiscovery() {
    this.node.on('peer:discovery', (peer) => {
      // console.log('Discovered:', peer.id.toB58String());
      this.node.dial(peer, () => { });
    });
    
    this.node.on('peer:connect', (peer) => {
      console.log(chalk.green(`Add libp2p peer: ${peer.id.toB58String()}`));
      this.peers[peer.id.toB58String()] = { peer };
    });

    this.node.on('peer:disconnect', (peer) => {
      delete this.peers[peer.id.toB58String()];
      console.error(chalk.red(`Peer disconnected - (${peer.id.toB58String()}`));
    });
  }

  broadcast(msg, peerId) {
    const cb = msg => (err, conn) => {
      if (err) { throw err; }
      pull(pull.values([msg.toString('hex')]), conn);
    };

    if (peerId) {
      this.node.dialProtocol(peerId, '/shh', cb(msg));
    } else {
      for (let peerId of Object.keys(this.peers)) {
        let peer = this.peers[peerId].peer;
        this.node.dialProtocol(peer, '/shh', cb(msg));
      }
    }
  }

  addTrustedPeer(node){
    this.trustedPeers.push(node);
  }

  addStaticPeer(node, cb){
    this.staticnodes.push(node);
    // TODO: bootnodes
  }

  isTooOld(expiry) {
    const dt = (new Date()).getTime() / 1000;
    return expiry.readUInt32BE(0) < dt;
  }
}

  
module.exports = LibP2PNode;
