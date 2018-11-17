const devp2p = require('ethereumjs-devp2p')
const LRUCache = require('lru-cache')
const ms = require('ms')
const chalk = require('chalk')
const assert = require('assert')
const rlp = require('rlp-encoding')
const Buffer = require('safe-buffer').Buffer
const SHH = require('./shh.js')

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

    // TODO: obtain this from config file
    this.rlpx.connect({ id: Buffer.from("da61e9eff86a56633b635f887d8b91e0ff5236bbc05b8169834292e92afb92929dcf6efdbf373a37903da8fe0384d5a0a8247e83f1ce211aa429200b6d28c548", "hex"), address: "47.91.156.93", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("c42f368a23fa98ee546fd247220759062323249ef657d26d357a777443aec04db1b29a3a22ef3e7c548e18493ddaf51a31b0aed6079bd6ebe5ae838fcfaf3a49", "hex"), address: "206.189.243.162", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("7de99e4cb1b3523bd26ca212369540646607c721ad4f3e5c821ed9148150ce6ce2e72631723002210fac1fd52dfa8bbdf3555e05379af79515e1179da37cc3db", "hex"), address: "35.188.19.210", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("744098ab6d3308af5cd03920aea60c46d16b2cd3d33bf367cbaf1d01c2fcd066ff8878576d0967897cd7dbb0e63f873cc0b4f7e4b0f1d7222e6b3451a78d9bda", "hex"), address: "47.89.20.15", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("7aa648d6e855950b2e3d3bf220c496e0cae4adfddef3e1e6062e6b177aec93bc6cdcf1282cb40d1656932ebfdd565729da440368d7c4da7dbd4d004b1ac02bf8", "hex"), address: "206.189.243.169", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("015e22f6cd2b44c8a51bd7a23555e271e0759c7d7f52432719665a74966f2da456d28e154e836bee6092b4d686fe67e331655586c57b718be3997c1629d24167", "hex"), address: "35.226.21.19", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("74957e361ab290e6af45a124536bc9adee39fbd2f995a77ace6ed7d05d9a1c7c98b78b2df5f8071c439b9c0afe4a69893ede4ad633473f96bc195ddf33f6ce00", "hex"), address: "47.52.255.195", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("8a64b3c349a2e0ef4a32ea49609ed6eb3364be1110253c20adc17a3cebbc39a219e5d3e13b151c0eee5d8e0f9a8ba2cd026014e67b41a4ab7d1d5dd67ca27427", "hex"), address: "206.189.243.168", port: 30504 })
    this.rlpx.connect({ id: Buffer.from("531e252ec966b7e83f5538c19bf1cde7381cc7949026a6e499b6e998e695751aadf26d4c98d5a4eabfb7cefd31c3c88d600a775f14ed5781520a88ecd25da3c6", "hex"), address: "35.225.227.79", port: 30504 })
    

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
