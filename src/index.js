const Provider = require('./provider');
const Manager = require('./manager');

class Murmur {  
  constructor(options) {
    this.isBridge = options.isBridge;
    this.protocols = options.protocols || [];
    this.address = options.address || '/ip4/0.0.0.0/tcp/0';
    this.bootnodes = options.bootnodes || [];
    this.nodes = [];
    
    this.provider = new Provider();
    this.manager = new Manager(this.provider, {
      isBridge: this.isBridge, 
      address: this.address, 
      bootnodes: this.bootnodes
    });
  }

  async start() {
    if(this.protocols.indexOf("devp2p") > -1){
      const devp2p = require("./clients.js");
      devp2p.start();
      devp2p.connectTo({address: '127.0.0.1', udpPort: 30303, tcpPort: 30303});
      this.nodes.push(devp2p);
    }

    if(this.protocols.indexOf("libp2p") > -1){
      const LibP2PNode = require('./libp2p-node.js');
      const libp2p = new LibP2PNode();
      libp2p.start();
      this.nodes.push(libp2p);
    }

    this.manager.setupNodes(this.nodes);
    this.manager.start();
  }
}

module.exports = Murmur;
