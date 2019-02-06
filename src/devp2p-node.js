const devp2p = require('ethereumjs-devp2p');
// const LRUCache = require('lru-cache');
const ms = require('ms');
const chalk = require('chalk');
const assert = require('assert');
const rlp = require('rlp-encoding');
const SHH = require('./shh.js').default;
const {SHH_BLOOM, SHH_MESSAGE, SHH_STATUS} = require('./constants');
const Events = require('events');
const ip = require('ip');
const {topicToBloom, bloomFilterMatch} = require('./bloom');


const devP2PHello = (id, port) => {
  console.log(chalk.yellow("* devP2P started: true, listening on:"));
  console.log(chalk.yellow("- " + id.toString('hex') + '@' + ip.address() + ":" + port));
};

const getPeerAddr = (peer) => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`;

class DevP2PNode {

  constructor(options) {
    this.chainId = options.chainId;
    this.privateKey = options.privateKey;
    this.bootnodes = options.bootnodes || [];
    this.staticnodes = options.staticnodes || [];
    this.trustedPeers = [];
    this.events = new Events();
    this.peers = {};

    // Candidate for DI
    this.tracker = null;
    this.bloomManager = null;
  }

  setTracker(tracker){
    this.tracker = tracker;
  }

  setBloomManager(bloomManager){
    this.bloomManager = bloomManager;
    this.bloomManager.on('updated', () => {
      this.broadcast(rlp.encode(this.bloomManager.getBloomFilter()), null, SHH_BLOOM);
    });
  }

  start(ip, port) {
    this.ip = "0.0.0.0";
    this.port = "30303";

    this._startDPT();
    this._startRLPX();
    if (ip) {
      this.rlpx.listen(port, ip);
      this.dpt.bind(port, ip);
    }

    this.addBootnodes(this.bootnodes);
  }

  broadcast(msg, peerId, code = SHH_MESSAGE, bloom = null) {
    if(code === null) code = SHH_MESSAGE;

    if (peerId){
      let peer = this.peers[peerId];
      peer.shh.sendRawMessage(code, msg);
    } else {
      for (let peerId of Object.keys(this.peers)) {
        let peer = this.peers[peerId];
        if(code == SHH_MESSAGE && !bloomFilterMatch(bloom, peer.bloom)) continue;
        peer.shh.sendRawMessage(code, msg);
      }
    }
  }

  _startDPT() {
    this.dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: 30000,
      endpoint: { address: '0.0.0.0', udpPort: null, tcpPort: null }
    });
    this.dpt.on('error', (err) => console.error(chalk.red(`DPT error: ${err}`)));
  }

  addTrustedPeer(node){
    this.trustedPeers.push(node);
  }

  addStaticPeer(node, cb){
    this.staticnodes.push(node);
    this.rlpx.connect({id: node.id, address: node.address, port: node.port})
      .then(_res => {
        cb(null, true);
      })
      .catch(err => {
        if (err.message.indexOf("Already connected") > -1){
          cb(null, true);
        } else {
          cb(err);
        }
      });
  }

  isTooOld(expiry) {
    const dt = (new Date()).getTime() / 1000;
    return expiry.readUInt32BE(0) < dt;
  }

  _startRLPX() {
    this.rlpx = new devp2p.RLPx(this.privateKey, {
      dpt: this.dpt,
      maxPeers: 50,
      capabilities: [
      //  devp2p.ETH.eth63,
      //  devp2p.ETH.eth62,
      //  devp2p.LES.les2,
        { name: 'shh', version: 6, length: 300, constructor: SHH },

      ],
      listenPort: null
    });

    this.staticnodes.map(node => {
      this.rlpx.connect({id: node.id, address: node.address, port: node.port});
    });

    devP2PHello(this.rlpx._id, this.port);    

    this.rlpx.on('error', (err) => console.error(chalk.red(`RLPx error: ${err.stack || err}`)));

    this.rlpx.on('listening', () => {
      this.events.emit('ready');
    });
    
    this.rlpx.on('peer:added', (peer) => {
      const shh = peer.getProtocols()[0];

      let peerId = peer._hello.id.toString('hex');

      this.peers[peerId] = { peer, shh };

      shh.events.on("status", status => {
        // TODO: don't hardcode minpow
        //               version           minPow                           bloom                               isLigthNode,     confirmationsEnbaled, 
        const payload = [status[0], Buffer.from("3f50624dd2f1a9fc", "hex"), this.bloomManager.getBloomFilter(), Buffer.from([]), Buffer.from([1])];
        this.broadcast(rlp.encode(payload), null, SHH_STATUS);
      });

      shh.events.on('message', (message, peer) => {
        let [expiry, ttl, topic, data, nonce] = message;

        if(this.tracker.exists(message, 'devp2p')) return;

        // Verify if message matches bloom filter
        const bloom = topicToBloom(topic);
        if(!this.bloomManager.match(bloom)) return;

        // Verifying if old message is sent by trusted peer
        if(this.isTooOld(expiry) && !this.trustedPeers.includes(peer)) return;

        this.tracker.push(message, 'devp2p');

        // Broadcast received message again.
        this.broadcast(rlp.encode([message]), null, SHH_MESSAGE, bloom);

        this.events.emit('shh_message', message);
      });

      const clientId = peer.getHelloMessage().clientId;
      console.log(chalk.green(`Add devp2p peer: ${getPeerAddr(peer)} ${clientId}`));
    });

    this.rlpx.on('peer:removed', (peer, reasonCode, disconnectWe) => {
      const staticNode = this.staticnodes.find(x => x.id.equals(peer._remoteId));
      if (staticNode){
        // TODO: if a static node dies, attempt to reconnect.
        this.rlpx.connect({id: staticNode.id, address: staticNode.address, port: staticNode.port});
      }

      const who = disconnectWe ? 'we disconnect' : 'peer disconnect';
      const total = this.rlpx.getPeers().length;
      console.log(chalk.yellow(`Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(reasonCode)} (${String(reasonCode)}) (total: ${total})`));
    });

    this.rlpx.on('peer:error', (peer, err) => {
      if (err.code === 'ECONNRESET') {
        return;
      }

      if (err instanceof assert.AssertionError) {
        const peerId = peer.getId();
        if (peerId !== null) this.dpt.banPeer(peerId, ms('5m'));

        console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.message}`));
        return;
      }

      console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.stack || err}`));
    });
  }

  addBootnodes(bootnodes) {
    bootnodes.forEach((bootnode) => {
      this.dpt.bootstrap(bootnode).catch((err) => {
        console.error(chalk.bold.red(`DPT bootstrap error: ${err.message}`));
      });
    });
  }

  connectTo(node) {
    this.dpt.addPeer(node).then((peer) => {
      console.dir("==> peer added");
      return this.rlpx.connect({
        id: peer.id,
        address: peer.address,
        port: peer.tcpPort
      });
    }).catch((err) => console.log(chalk.bold.red(`error on connection to local node: ${err.message}`)));
  }

}

module.exports = DevP2PNode;
