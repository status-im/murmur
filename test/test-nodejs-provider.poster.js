const Murmur = require('../src/index');
const Web3 = require('web3');

console.log("Connecting...");
 
const server = new Murmur({
  protocols: ["libp2p"],
  signalServer: { host: '104.248.64.24', port: '9090', protocol: 'ws' },
  bootnodes: []
});

server.start();

setTimeout(
(async() => {
  const web3 = new Web3(server.provider);
  const symKey = await web3.shh.generateSymKeyFromPassword('ABC');

  const privKey = await web3.shh.newKeyPair();

  const msgId = web3.shh.post({
    symKeyID: symKey,
    topic: "0x01020304",
    payload: web3.utils.toHex('Hello from nodejs'),
    powTarget: 0.002,
    powTime: 1,
    ttl: 10,
    sig: privKey
  });


}), 10000);

setInterval(() => {
  console.log("...");
}, 3000);
