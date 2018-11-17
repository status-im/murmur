const devp2p = require('ethereumjs-devp2p')
const LRUCache = require('lru-cache')
const ms = require('ms')
const chalk = require('chalk')
const assert = require('assert')
const rlp = require('rlp-encoding')
const Buffer = require('safe-buffer').Buffer
const SHH = require('./shh.js')
const staticNodes = require('./data/static-nodes.json');

const getPeerAddr = (peer) => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`;

class Ethereum {

  constructor(options) {
    this.chainId = options.chainId;
    this.privateKey = options.privateKey;
    this.bootnodes = options.bootnodes || [];
  }

  start(ip, port) {
    this._startDPT()
    this._startRLPX()

    if (ip) {
      this.rlpx.listen(port, ip)
      this.dpt.bind(port, ip)
    }

    this.addBootnodes(this.bootnodes)
  }

  _startDPT() {
    this.dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: 30000,
      endpoint: { address: '0.0.0.0', udpPort: null, tcpPort: null }
    })

    this.dpt.on('error', (err) => console.error(chalk.red(`DPT error: ${err}`)))
  }

  _startRLPX() {
    this.rlpx = new devp2p.RLPx(this.privateKey, {
      dpt: this.dpt,
      maxPeers: 25,
      capabilities: [
        { name: 'shh', version: 6, length: 17, constructor: SHH }
      ],
      listenPort: null
    })

    staticNodes.map(node => {
      const id = Buffer.from(node.id, 'hex');
      this.rlpx.connect({id, address: node.address, port: node.port});
    });

    this.rlpx.on('error', (err) => console.error(chalk.red(`RLPx error: ${err.stack || err}`)))

    this.rlpx.on('peer:added', (peer) => {
      const shh = peer.getProtocols()[0]

      const clientId = peer.getHelloMessage().clientId
      console.log(chalk.green(`Add peer: ${getPeerAddr(peer)} ${clientId} (total: ${this.rlpx.getPeers().length})`))

    })

    this.rlpx.on('peer:removed', (peer, reasonCode, disconnectWe) => {
      const who = disconnectWe ? 'we disconnect' : 'peer disconnect'
      const total = this.rlpx.getPeers().length
      console.log(chalk.yellow(`Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(reasonCode)} (${String(reasonCode)}) (total: ${total})`))
    })

    this.rlpx.on('peer:error', (peer, err) => {
      if (err.code === 'ECONNRESET') return

      if (err instanceof assert.AssertionError) {
        const peerId = peer.getId()
        if (peerId !== null) this.dpt.banPeer(peerId, ms('5m'))

        console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.message}`))
        return
      }

      console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.stack || err}`))
    })
  }

  addBootnodes(bootnodes) {
    this.bootnodes.forEach((bootnode) => {
      this.dpt.bootstrap(bootnode).catch((err) => {
        console.error(chalk.bold.red(`DPT bootstrap error: ${err.stack || err}`))
      })
    })
  }

  connectTo(node) {
    this.dpt.addPeer(node).then((peer) => {
      console.dir("==> peer added")
      return this.rlpx.connect({
        id: peer.id,
        address: peer.address,
        port: peer.tcpPort
      })
    }).catch((err) => console.log(`error on connection to local node: ${err.stack || err}`))
  }

}

module.exports = Ethereum;
