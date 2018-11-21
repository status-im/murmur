const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const messages = require('./messages.js')
const {keccak256} = require("eth-lib/lib/hash");

class Manager {

  constructor(node, provider) {
    this.node = node;
    this.provider = provider;
    this.keys = {};
    this.listenToProviderEvents();
    this.listenToNodeEvents();

    this.subscriptionId = 0;
  }

  listenToProviderEvents() {
    this.provider.events.on('post', (payload) => {
      const {
        symKeyID,
        pubKey,
        sig,
        ttl,
        topic,
        padding,
        powTime,
        powTarget,
        targetPeer
      } = payload;
      const messagePayload = payload.payload;

      // TODO: sign and send message to node
      // this.node.events.emit("ssh_send_message", message)
    });

    // TODO: this needs to refactored to take into account different clients
    this.provider.events.on('subscribe', (payload, cb) => {
      const { minPow, privateKeyID, topics, allowP2P } = payload;
      const id = randomBytes(32).toString('hex');
      this.subscriptionId = id;

      cb(null, id);
    });

    this.provider.events.on("newKeyPair", (cb) => {
      const id = randomBytes(32).toString('hex');
      const privKey = randomBytes(32);
      const pubKey = secp256k1.publicKeyCreate(privKey);

      this.keys[id] = {
        privKey: privKey.toString('hex'),
        pubKey: pubKey.toString('hex')
      };

      cb(null, id);
    });

    this.provider.events.on("getPublicKey", (id, cb) => {
      const key = this.keys[id];
      if (!key) { return cb("key not found"); }

      cb(null, key.pubKey);
    });

    this.provider.events.on("getPrivateKey", (id, cb) => {
      const key = this.keys[id];
      if (!key) { return cb("key not found"); }

      cb(null, key.privKey);
    });
  }

  listenToNodeEvents() {
    this.node.events.on('shh_message', (message) => {
      console.dir('received message, sending to subscribers...');

      let [expiry, ttl, topic, data, nonce] = message;

      if (!topic.equals(Buffer.from("27ee704f", "hex"))) {
        console.dir("unkwnon topic (TODO); ignoring message");
        return;
      }

      let key = Buffer.from("e0c69378eaa4845cd27036f7b77447c2ab0ede5389a178839bc2b44d8441d07c", "hex");
      let id = keccak256(message.join(''));

      messages.decryptSymmetric(topic, key, data, (err, decrypted) => {
        console.dir("--------------");
        console.dir(id);
        console.dir(decrypted.payload.toString());
        console.dir(decrypted.pubKey.toString('hex'));
        console.dir("--------------");

        this.provider.transmit({
          "jsonrpc": "2.0",
          "method": "shh_subscription",
          "params": {
            subscription: this.subscriptionId,
            result: {
              sig: "0x" + decrypted.pubKey.toString('hex'),
              // recipientPublicKey: null,
              // ttl: ttl,
              ttl: 10, // TODO: correct value
              timestamp: 1498577270, // TODO: correct value
              topic: "0x" + topic.toString('hex'),
              payload: "0x" + decrypted.payload.toString('hex'),
              //padding: decrypted.padding.toString('hex'),
              padding: null,
              pow: 0.671, // TODO: correct value
              hash: id
            }
          }
        })
        //this.provider.
      });
      // console.dir(message)
      // TODO: send to clients sbuscribed to this message topic
    })
  }

}

module.exports = Manager;
