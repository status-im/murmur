const LibP2PBundle = require('./libp2p-bundle');
const PeerInfo = require('peer-info');
const chalk = require('chalk');
const pull = require('pull-stream');
const drain = require('pull-stream/sinks/drain');

const Events = require('events');

let p2pNode;

const libP2Phandler = (err) => {
  if (err) { throw err; }
  console.log(chalk.yellow(`* libP2P started: ${p2pNode.isStarted()}, listening on:`));
  p2pNode.peerInfo.multiaddrs.forEach((ma) => console.log(chalk.yellow("- " + ma.toString())));
};

// TODO: refactor this and devp2p so message tracker is shared
const messageTracker = [];

const createNode = (address, events) => {
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
          pull.map((v) => v.toString()),
          drain(message => {
            console.log("Received message: " + message);
          })
        );


        // TODO: 
        // Verify message tracker
        // Verify if too old

        // add to tracker
        // emit event


        /*
        let [expiry, ttl, topic, data, nonce] = message;

        let id = keccak256(message.join(''));

        if (this.messagesTracker[id]) {
        //  console.dir("same message: " + id)
          return;
        }

        // Verifying if old message is sent by trusted peer
        if(this.isTooOld(expiry) && !this.trustedPeers.includes(peer)){
          console.log("Discarting old envelope");
          return;
        }

        this.messagesTracker[id] = ttl;
        */

      // events.emit('shh_message', message);
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
    }

    async start(ip, port){
      if(!ip) ip = "0.0.0.0";
      if(!port) port = "0";
      const address =  `/ip4/${ip}/tcp/${port}`;
      this.node = await createNode(address, this.events);
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
    // TODO:
  }
}

  
module.exports = LibP2PNode;
