const Provider = require('./provider');
const node = require('./client.js');
const Manager = require('./manager');

class Murmur {
  constructor() {
    this.provider = new Provider();
    this.manager = new Manager(node, this.provider);
  }

  start() {
    node.start();
    node.connectTo({address: '127.0.0.1', udpPort: 30303, tcpPort: 30303});
  }

  // provider() {
  //   this.provider;
  // }
}

module.exports = Murmur;
