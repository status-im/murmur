const PeerInfo = require('peer-info');
const PeerId = require('peer-id');
const LibP2PBundle = require('./libp2p-bundle');
const chalk = require('chalk');
const pull = require('pull-stream');
const drain = require('pull-stream/sinks/drain');
const rlp = require('rlp-encoding');
const Events = require('events');
const config = require('../data/config.json');
const {SHH_BLOOM, SHH_MESSAGE, SHH_STATUS} = require('./shh.js');
const Envelope = require('./envelope');

const PROTOCOL = '/ethereum/shh/6.0.0/dev-v1';

let p2pNode;

const libP2Phello = eventEmitter => err => {
  if (err) { throw err; }
  console.log(chalk.yellow(`* libP2P started: ${p2pNode.isStarted()}, listening on:`));
  p2pNode.peerInfo.multiaddrs.forEach((ma) => console.log(chalk.yellow("- " + ma.toString())));
  eventEmitter.emit('ready');
};

const createNode = (self) => {
  return new Promise(function(resolve, reject) {

    const nodeHandler = (err, peerInfo) => {
      if(err) {
        reject(err);
      }

      p2pNode = new LibP2PBundle(peerInfo, {
        startWRTC: !self.isBrowser,
        signalServers: self.signalServers,
        bootnodes: self.bootnodes
      });  

      p2pNode.old_start = p2pNode.start;
      p2pNode.start = () => {
        p2pNode.old_start(libP2Phello(self.events));
      };

      p2pNode.handle(PROTOCOL, (protocol, conn) => {
        pull(conn,
          pull.map((v) => rlp.decode(Buffer.from(v.toString(), 'hex'))),
          drain(message => {
            conn.getPeerInfo((err, peerInfo) => {
              try {
                const code = message[0].readUInt8(0);
                const payload = rlp.decode(message[1]);
                const peerId = peerInfo.id.toB58String();

                if (code === SHH_STATUS) p2pNode.emit('status', payload, peerId);
                
                if (code === SHH_BLOOM) p2pNode.emit('bloom_exchange', payload, peerId);
                
                if (code === SHH_MESSAGE) {
                  payload.forEach((envelope) => {
                    p2pNode.emit('message', new Envelope(envelope), peerId);
                  });
                }
              } catch (e) {
                console.log("Invalid message: " + e.message);
              }
            });
          })
        );
      });
      resolve(p2pNode);
    };

    // TODO: probably not secure and prone to errors. Fix
    //       also, what's the diff between createFromHexString and createFromPrivKey?
    const privateKey = self.privateKey ? Buffer.from(self.privateKey, "hex") : null;
    if(privateKey){
      const peerId = PeerId.createFromHexString(privateKey);
      PeerInfo.create(peerId, nodeHandler);
    } else {
      PeerInfo.create(nodeHandler);
    }
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
      this.peers = {};
      this.type = "libp2p";

      // Candidates for DI
      this.tracker = null;
      this.bloomManager = null;
      
      this.isBrowser = options.isBrowser || false;
      this.signalServers = options.signalServers || [];
    }

    setConfig(config){
      this.bootnodes = config.bootnodes;
      this.privateKey = config.account ? Buffer.from(config.account, "hex") : null;
    }

    setTracker(tracker){
      this.tracker = tracker;
    }

    setBloomManager(bloomManager){
      this.bloomManager = bloomManager;
      this.bloomManager.on('updated', () => {
        this.broadcast(this.bloomManager.getBloomFilter(), null, SHH_BLOOM);
      });
    }

    async start(){
      this.node = await createNode(this);
      this.node.start();
      this._startDiscovery();
      this._processMessages();
    }

  _startDiscovery() {
    this.node.on('peer:discovery', (peer) => {
      // console.log('Discovered:', peer.id.toB58String());
      this.node.dial(peer, () => { });
    });
    
    this.node.on('peer:connect', (peer) => {
      console.log(chalk.green(`Add libp2p peer: ${peer.id.toB58String()}`));

      const peer_id = peer.id.toB58String();
      if(!this.peers[peer_id]) this.peers[peer_id] = {}; 
      this.peers[peer_id].peer = peer;

      // Sending the status on initial connection
      const payload = [Buffer.from([6]), Buffer.from("3f50624dd2f1a9fc", "hex"), this.bloomManager.getBloomFilter(), Buffer.from([]), Buffer.from([1])];
      this.broadcast(payload, peer.id.toB58String(), SHH_STATUS);
    });

    this.node.on('peer:disconnect', (peer) => {
      delete this.peers[peer.id.toB58String()];
      console.error(chalk.red(`Peer disconnected - (${peer.id.toB58String()}`));
    });
  }

  _processMessages(){
    this.node.on('message',  (envelope, peer) => {
      if(this.tracker.exists(envelope, 'libp2p')) return;

      // Verify if message matches bloom filter
      if(!this.bloomManager.match(envelope.bloom)) return;

      // Verifying if old message is sent by trusted peer
      // @TODO: for mailservers inspect peer
      // const trustedPeer = this.trustedPeers.includes(peer); 
      const tooOld = this.isTooOld(envelope.expiry);

      // Discarding old envelope unless sent by trusted peer
      // if(tooOld && !trustedPeer) return; 

      this.tracker.push(envelope, 'libp2p');
      
      // Broadcast received message again.
      if(!tooOld) this.broadcast(envelope);

      this.events.emit('shh_message', envelope);
    });

    this.node.on("status", (status, peerId) => {
      this.peers[peerId].bloom = status[2];
    });

    this.node.on("bloom_exchange", (bloom, peerId) => {
      this.peers[peerId].bloom = bloom;
    });
  }

  broadcast(input, peerId, code = SHH_MESSAGE) {
    const message = rlp.encode(input instanceof Envelope ? [input.message] : input);

    if(code === null) code = SHH_MESSAGE;

    const cb = (code, msg) => (err, conn) => {
      code = Buffer.from([code]);
      const payload = rlp.encode([code, msg]);
      if (!err) pull(pull.values([payload.toString('hex')]), conn);
    };

    if (peerId) {
      let peer = this.peers[peerId].peer;
      this.node.dialProtocol(peer, PROTOCOL, cb(code, message));
    } else {
      for (let peerId of Object.keys(this.peers)) {
        let p = this.peers[peerId];

        if(code == SHH_MESSAGE && !this.bloomManager.filtersMatch(p.bloom, input.bloom)) continue;

        this.node.dialProtocol(p.peer, PROTOCOL, cb(code, message));
      }
    }
  }

  addTrustedPeer(node){
    this.trustedPeers.push(node);
  }

  isTooOld(expiry) {
    const dt = (new Date()).getTime() / 1000;
    return expiry.readUInt32BE(0) < dt;
  }
}


module.exports = LibP2PNode;
