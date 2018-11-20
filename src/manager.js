const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')

class Manager {

  constructor(node, provider) {
    this.node = node;
    this.provider = provider;
    this.keys = {};
    this.listenToProviderEvents();
    this.listenToNodeEvents();
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

    this.provider.events.on('subscribe', (payload, cb) => {
      const { minPow, privateKeyID, topics, allowP2P } = payload;
      const id = randomBytes(32).toString('hex');

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
      console.dir('received message, sending to subscribers...')
      // console.dir(message)
      // TODO: send to clients sbuscribed to this message topic
    })
  }

}

module.exports = Manager;
