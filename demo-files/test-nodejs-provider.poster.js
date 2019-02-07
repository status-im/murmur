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
  const channelName = "mytest";
  const web3 = new Web3(server.provider);
  const symKey = await web3.shh.generateSymKeyFromPassword(channelName);

  const privKey = await web3.shh.newKeyPair();

  const msgId = web3.shh.post({
    symKeyID: symKey,
    topic: Web3.utils.sha3(channelName).slice(0, 10),
    payload: web3.utils.toHex(`["~#c4",["{\"type\":\"HOLA\"}","content/json","~:public-group-user-message",155225785749405,1549579479431,["^ ","~:text","{\"type\":\"ping\"}"]]]`),
    powTarget: 0.002,
    powTime: 1,
    ttl: 10,
    sig: privKey
  });


}), 10000);

setInterval(() => {
  console.log("...");
}, 3000);
