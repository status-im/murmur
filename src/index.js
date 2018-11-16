const Ethereum = require('./ethereum.js');
const { randomBytes } = require('crypto')

const CHAIN_ID = 3
const BOOTNODES = require('ethereum-common').bootstrapNodes.filter((node) => {
  return node.chainId === CHAIN_ID
}).map((node) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port
  }
})

const node  = new Ethereum({
  chainId: CHAIN_ID,
  privateKey: randomBytes(32),
  bootnodes: BOOTNODES
});

//node.start('0.0.0.0', 30305)
node.start()
node.connectTo({address: '127.0.0.1', udpPort: 30303, tcpPort: 30303})

