const Murmur = require('../src/index');
const Web3 = require('web3');

console.log("Connecting...");
 
const server = new Murmur({
  protocols: ["libp2p"],
  signalServer: { host: '0.0.0.0', port: '9090', protocol: 'ws' },
  bootnodes: []
});

server.start();

setTimeout(
(async() => {
  const web3 = new Web3(server.provider);
  const symKey = await web3.shh.generateSymKeyFromPassword('ABC');

  const filters = {
    symKeyID: symKey,
    topics: ["0x01020304"],
  };

  web3.shh.subscribe("messages", filters)
    .on("data", (data) => { console.log(data); })
    .on("error", (err) => { console.error(err); });

}), 10000);

setInterval(() => {
  console.log("...");
}, 3000);
