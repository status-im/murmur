const { randomBytes, pbkdf2 } = require('crypto')
const secp256k1 = require('secp256k1')
const messages = require('./messages.js')
const {keccak256} = require("eth-lib/lib/hash");
const gcm = require('node-aes-gcm');
const crypto = require('crypto');

const stripHexPrefix = require('strip-hex-prefix');
const devp2p = require('ethereumjs-devp2p');
const constants = require('./constants');

function transformBufferIntoNBytes(buf, intendedSize) {
  let newBuffer = new Buffer(intendedSize);
  if (intendedSize <= buf.length) {
    return buf.slice(0, intendedSize)
  }
  let startIndex = intendedSize - buf.length;
  for (let i = 0; i < intendedSize; i++) {
    if (i < startIndex) {
      continue;
    }
    newBuffer[i] = buf[i - startIndex];
  }
  return newBuffer;
}
class Manager {

  constructor(node, provider) {
    this.node = node;
    this.provider = provider;

    this.keys = {};
    this.subscriptions = {};

    this.listenToProviderEvents();
    this.listenToNodeEvents();
  }

  listenToProviderEvents() {
    this.provider.events.on('post', (payload) => {
      let {
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
      const messagePayload = Buffer.from(stripHexPrefix(payload.payload), 'hex');

      // TODO move this to mesages
      console.log("POSTING MESSAGE")
      padding = padding | Buffer.from([]);

      const options = {
      };

      if(ttl == 0){
        ttl = 50; // Default TTL
      }

      options.expiry = Math.floor((new Date()).getTime() / 1000.0) + ttl;

      if(!!sig){
        options.from = this.keys[sig];
        if(!options.from || !options.from.privKey){
          // TODO: trigger error No identity found
          console.log("No identity found");
        }
      }

      // Set symmetric key that is used to encrypt the message
      if(!!symKeyID){ // symKeyGiveng
        if(!topic){
          // TODO: trigger error:  Topic is required
          console.log("Topic is required");

        }

        options.symKey = this.keys[symKeyID];
        if (!options.symKey || !options.symKey.symmetricKey) console.log("NoSimKeyFound");// TODO trigger error:  No simkey found

        // TODO: validate data integrity of key, with aesKeyLength to know if symmetric key is valid, and it's different of 0
      }
      
      let  envelope = messages.buildMessage(messagePayload, padding, sig, options);

      if(options.symKey){
        messages.encryptSymmetric(topic, envelope, options, (err, res) => {
          if(err){
            // TODO print error encrypting msg
            return;
          }

          // TODO: Pow the message
        });


      }

  


  // Send
  /*
// ensure that the message PoW meets the node's minimum accepted PoW
if req.PowTarget < api.w.MinPow() {
  return ni*///l, ErrTooLowPoW
//}//

//err = api.w.Send(env)







      // symKeyID - id of key for encryption
      // sig - id of key for signing
/*
      let envelope = []

      let expiry_int = Math.floor((new Date()).getTime() / 1000.0) + ttl;
      envelope.push(transformBufferIntoNBytes(devp2p._util.int2buffer(expiry_int), 4))
      envelope.push(transformBufferIntoNBytes(devp2p._util.int2buffer(ttl), 4))
      envelope.push(transformBufferIntoNBytes(messages.hexToBytes(topic.slice(2)), 4))

      console.dir("--- got topic");
      console.dir(topic);
      console.dir(transformBufferIntoNBytes(messages.hexToBytes(topic.slice(2)), 4))

      // TODO: sign and send message to node
      // this.node.events.emit("ssh_send_message", message)
      this.node.broadcast("ssh_send_message", payload)*/
    });

    // TODO: this needs to refactored to take into account different clients
    this.provider.events.on('subscribe', (payload, cb) => {
      const { minPow, symKeyID, privateKeyID, topics, allowP2P } = payload;
      const id = randomBytes(constants.keyIdLength).toString('hex');
      for (let topic of topics) {
        console.dir("==> topic")
        console.dir(topic.toString('hex'))
        if (!this.subscriptions[topic]) {
          this.subscriptions[topic] = {}
        }
        this.subscriptions[topic][id] = {
          privateKeyID,
          symKeyID
        }
      }

      cb(null, id);
    });

    this.provider.events.on("newKeyPair", (cb) => {
      const id = randomBytes(constants.keyIdLength).toString('hex');

      if(this.keys[id]) return cb("key is not unique");

      const privKey = randomBytes(constants.privKeyLength);
      const pubKey = secp256k1.publicKeyCreate(privKey);

      this.keys[id] = {
        privKey: "0x" + privKey.toString('hex'),
        pubKey: "0x" + pubKey.toString('hex')
      };

      cb(null, id);
    });

    this.provider.events.on("addPrivateKey", (privKey, cb) => {
      const id = randomBytes(constants.keyIdLength).toString('hex');

      if(this.keys[id]) return cb("key is not unique");

      privKey = stripHexPrefix(privKey);

      this.keys[id] = {
        privKey: "0x" + privKey,
        pubKey: "0x" + secp256k1.publicKeyCreate(Buffer.from(privKey, "hex")).toString('hex')
      };

      cb(null, id);
    });

    this.provider.events.on("getPublicKey", (id, cb) => {
      const key = this.keys[id];
      if (!key || !key.pubKey) { return cb("key not found"); }

      cb(null, key.pubKey);
    });

    this.provider.events.on("getPrivateKey", (id, cb) => {
      const key = this.keys[id];
      if (!key || !key.privKey) { return cb("key not found"); }

      cb(null, key.privKey);
    });

    this.provider.events.on("hasKeyPair", (id, cb) => {
      const key = this.keys[id];
      cb(null, !!key && !!key.privKey);
    });

    const deleteKey = (id, cb) => {
      if(id.length / 2 != constants.keyIdLength){
        const errMsg = "invalid id";
        return cb(errMsg);
      }

      if(this.keys[id]){
        delete this.keys[id];
        cb(null, true);
      } else {
        cb(null, false);
      }
    }

    this.provider.events.on("deleteKeyPair", (id, cb) => {
      deleteKey(id, cb);
    });

    this.provider.events.on("addSymKey", (symmetricKey, cb) => {
      const id = randomBytes(constants.keyIdLength).toString('hex');

      if(this.keys[id]) return cb("key is not unique");

      if(stripHexPrefix(symmetricKey).length / 2 != constants.symKeyLength){
        return cb("wrong key size");
      }

      this.keys[id] = {
        symmetricKey: "0x" + stripHexPrefix(symmetricKey)
      };

      cb(null, id);
    });

    this.provider.events.on("newSymKey", (cb) => {
      const id = randomBytes(constants.keyIdLength).toString('hex');
      const symmetricKey = "0x" + randomBytes(constants.symKeyLength).toString('hex');

      if(this.keys[id]) return cb("key is not unique");

      this.keys[id] = {
        symmetricKey
      };

      cb(null, id);
    });

    this.provider.events.on("generateSymKeyFromPassword", (password, cb) => {
      const id = randomBytes(constants.keyIdLength).toString('hex');

      if(this.keys[id]) return cb("key is not unique");

      pbkdf2(password, "", 65356, constants.symKeyLength, 'sha256', (err, derivedKey) => {
        if (err) return cb(err);

        this.keys[id] = {symmetricKey: "0x" + derivedKey.toString('hex')};

        cb (null, id);
      });
    });

    this.provider.events.on("hasSymKey", (id, cb) => {
      const key = this.keys[id];
      cb(null, !!key && !!key.symmetricKey);
    });

    this.provider.events.on("getSymKey", (id, cb) => {
      const key = this.keys[id];
      if (!key || !key.symmetricKey) { return cb("key not found"); }

      cb(null, key.symmetricKey);
    });

    this.provider.events.on("deleteSymKey", (id, cb) => {
      deleteKey(id, cb);
    });
  }

  listenToNodeEvents() {
    this.node.events.on('shh_message', (message) => {
      console.dir('received message, sending to subscribers...');

      let [expiry, ttl, topic, data, nonce] = message;

      let topicSubscriptions = this.subscriptions['0x' + topic.toString('hex')];
      if (!topicSubscriptions) {
        return;
      }

      let id = keccak256(message.join(''));

      for (let subscriptionId of Object.keys(topicSubscriptions)) {
        console.dir(">>>>> subscription");
        let keyId = topicSubscriptions[subscriptionId].symKeyID;
        if (!keyId) {
          // TODO: try asymmetric decryption instead...
          return;
        }
        let key = Buffer.from(this.keys[keyId].symmetricKey.slice(2), 'hex');

        // TODO: room for improvement here, only needs to decrypt once, just need sto verify each key is valid/same for the same topic
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
              subscription: subscriptionId,
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
      }
      // console.dir(message)
      // TODO: send to clients sbuscribed to this message topic
    })
  }

}

module.exports = Manager;
