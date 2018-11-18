const Ethereum = require('./ethereum.js');
const { randomBytes } = require('crypto');
const staticNodesJson = require('./data/static-nodes.json');


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

const STATICNODES = require('./data/static-nodes.json').map((node) => {
  const p = node.split("@");
  const q = p[1].split(":");

  const id = Buffer.from(p[0].replace("enode://", ""), "hex");
  const address = q[0];
  const port = q[1];

  return { id, address, port }
})

const node  = new Ethereum({
  chainId: CHAIN_ID,
  privateKey: randomBytes(32),
  bootnodes: BOOTNODES,
  staticnodes: STATICNODES
});

//node.start('0.0.0.0', 30305)
node.start()
node.connectTo({address: '127.0.0.1', udpPort: 30303, tcpPort: 30303})

