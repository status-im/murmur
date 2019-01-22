const Murmur = require('./src/index');
const Web3 = require('web3');

const s = new Murmur({
  libP2PClient: true,
  bootnodes: ["/ip4/192.168.0.105/tcp/42971/ipfs/QmacmQeZs4NJJys8cjewQLYsmkrLkfnYWjh7cnWxNwvXQX"]
});
s.start();

const web3 = new Web3(s.provider);

setTimeout(
(async() => {
  const symKey = await web3.shh.generateSymKeyFromPassword('ABC');
  const privKey = await web3.shh.newKeyPair();
  const msgId = web3.shh.post({
    symKeyID: symKey,
    topic: "0x01020304",
    payload: web3.utils.toHex('HOLA'),
    powTarget: 0.002,
    powTime: 1,
    ttl: 10,
    sig: privKey
  });
  console.log("A");
}), 5000);
 // TODO: check if ready