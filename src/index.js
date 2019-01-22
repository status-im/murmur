const Provider = require('./provider');
const Manager = require('./manager');

class Murmur {  
  constructor(options) {
    this.isLibP2PClient = options.libP2PClient || false;
    this.isBridge = this.isLibP2PClient ? false : (options.isBridge || true);
    this.address = options.address || '/ip4/0.0.0.0/tcp/0';
    this.bootnodes = options.bootnodes || [];

    this.provider = new Provider();
    this.manager = new Manager(this.provider, {
      isLibP2PClient: this.isLibP2PClient, 
      isBridge: this.isBridge, 
      address: this.address, 
      bootnodes: this.bootnodes
    });
  }

  async start() {
    const nodes = [];


    if(this.isLibP2PClient || this.isBridge){
      const LibP2PNode = require('./libp2p-node.js');
      this.libp2p = await LibP2PNode.createNode(this.address);
    }

    if(!this.isLibP2PClient) {
      this.devp2p = require('./client.js');
    }


    if(this.devp2p){
      nodes.push(this.devp2p);
      this.devp2p.start();
      this.devp2p.connectTo({address: '127.0.0.1', udpPort: 30303, tcpPort: 30303});
    }

    if(this.libp2p){
      nodes.push(this.libp2p);
      this.libp2p.start();
    }

    this.manager.setupNodes(nodes);
    this.manager.start();
  }
}

module.exports = Murmur;
