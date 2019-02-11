const Murmur = require('../src/index');
const Web3 = require('web3');

console.log("Connecting...");
 
const server = new Murmur({
  protocols: ["libp2p"],
  signalServer: ["/dns4/web-bridge.status.im/tcp/443/wss/p2p-webrtc-star"],
  bootnodes: []
});

server.start();

setTimeout(
(async() => {
  const channelName = "status-js";
  const web3 = new Web3(server.provider);
  const symKey = await web3.shh.generateSymKeyFromPassword(channelName);
  
  const filters = {
    symKeyID: symKey,
    topics: [Web3.utils.sha3(channelName).slice(0, 10)],
  };

  web3.shh.subscribe("messages", filters)
    .on("data", (data) => { console.log(web3.utils.toAscii(data.payload)); })
    .on("error", (err) => { console.error(err); });

}), 10000);

setInterval(() => {
  console.log("...");
}, 3000);
