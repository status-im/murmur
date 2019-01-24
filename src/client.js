const DevP2PNode = require('./devp2p-node.js');
const { randomBytes } = require('crypto');

const CHAIN_ID = 3;

const BOOTNODES = require('ethereum-common').bootstrapNodes.filter((node) => {
  return node.chainId === CHAIN_ID;
}).map((node) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port
  };
});

const STATICNODES = require('../data/config.json').devp2p["static-nodes"].map((node) => {
  const p = node.split("@");
  const q = p[1].split(":");

  const id = Buffer.from(p[0].replace("enode://", ""), "hex");
  const address = q[0];
  const port = q[1];

  return { id, address, port };
});

const node  = new DevP2PNode({
  chainId: CHAIN_ID,
  privateKey: randomBytes(32),
  bootnodes: BOOTNODES,
  staticnodes: STATICNODES
});

node.type = "devp2p";

module.exports = node;
