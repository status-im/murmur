const devp2p = require('ethereumjs-devp2p');
// const LRUCache = require('lru-cache');
const ms = require('ms');
const chalk = require('chalk');
const assert = require('assert');
// const rlp = require('rlp-encoding');
// const Buffer = require('safe-buffer').Buffer;
const SHH = require('./shh.js');
const Events = require('events');
const {keccak256} = require("eth-lib/lib/hash");

const getPeerAddr = (peer) => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`;

class Ethereum {

  constructor(options) {
    this.chainId = options.chainId;
    this.privateKey = options.privateKey;
    this.bootnodes = options.bootnodes || [];
    this.staticnodes = options.staticnodes || [];
    this.trustedPeers = [];
    this.events = new Events();
    this.messagesTracker = {};
    this.peers = {};
  }

  start(ip, port) {
    this._startDPT();
    this._startRLPX();

    if (ip) {
      this.rlpx.listen(port, ip);
      this.dpt.bind(port, ip);
    }

    this.addBootnodes(this.bootnodes);
  }

  broadcast(msgType, msg) {
    if (msgType !== "ssh_send_message") return;

    for (let peerId of Object.keys(this.peers)) {
      let peer = this.peers[peerId];
      peer.shh.sendMessage(1, msg);
    }
  }

  rawBroadcast(msg, peerId, code = 1) {
    if (peerId){
      let peer = this.peers[peerId];
      peer.shh.sendRawMessage(code, msg);
    } else {
      for (let peerId of Object.keys(this.peers)) {
        let peer = this.peers[peerId];
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
      maxPeers: 25,
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

    this.rlpx.on('error', (err) => console.error(chalk.red(`RLPx error: ${err.stack || err}`)));

    this.rlpx.on('peer:added', (peer) => {
      const shh = peer.getProtocols()[0];

      let peerId = peer._hello.id.toString('hex');

      this.peers[peerId] = { peer, shh };
      console.dir(Object.keys(this.peers));

      shh.events.on('message', (message, peer) => {
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
        this.events.emit('shh_message', message);
      });

      const clientId = peer.getHelloMessage().clientId;
      console.log(chalk.green(`Add peer: ${getPeerAddr(peer)} ${clientId} (total: ${this.rlpx.getPeers().length})`))

    })

    this.rlpx.on('peer:removed', (peer, reasonCode, disconnectWe) => {
      const staticNode = this.staticnodes.find(x => x.id.equals(peer._clientId));
      if (staticNode){
        // Reconnect
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
        console.error(chalk.bold.red(`DPT bootstrap error: ${err.stack || err}`));
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
    }).catch((err) => console.log(`error on connection to local node: ${err.stack || err}`));
  }

}

module.exports = Ethereum;
