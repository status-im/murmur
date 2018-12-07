const { randomBytes, pbkdf2 } = require('crypto')
const secp256k1 = require('secp256k1')
const messages = require('./messages.js')
const {keccak256} = require("eth-lib/lib/hash");
const rlp = require('rlp-encoding');
const stripHexPrefix = require('strip-hex-prefix');
const constants = require('./constants');
const pow = require('./pow');
const Big = require('big.js');
const Uint64BE = require("int64-buffer").Uint64BE;

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
      
      let messagePayload = Buffer.from(stripHexPrefix(payload.payload), 'hex');
      
      topic = Buffer.from(stripHexPrefix(topic), 'hex');

      if(ttl == 0){
        ttl = 50; // Default TTL
      }

      const options = {};
      
      const expiry = Math.floor((new Date()).getTime() / 1000.0) + ttl;


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
        } else {
          if(topic.length > 4){
            console.log("Topic length is incorrect")
          }
        }

        options.symKey = this.keys[symKeyID];
        if (!options.symKey || !options.symKey.symmetricKey) console.log("NoSimKeyFound");// TODO trigger error:  No simkey found

        // TODO: validate data integrity of key, with aesKeyLength to know if symmetric key is valid, and it's different of 0
      } else {
          // TODO: validate that either pubkey or symkey exists
          // TODO: check if valid public key
      }

      let  envelope = messages.buildMessage(messagePayload, padding, sig, options, (err) => {
        if(err)
          console.log(err)
      });

      const dispatchEnvelope = (err, encryptedMessage) => {
        if(err){
          // TODO print error encrypting msg
          return;
        }

        const powResult = pow.ProofOfWork(powTarget, powTime, ttl, topic, encryptedMessage, expiry);
                
        let nonceBuffer =  powResult.nonce;
        let non0 = false;
        let val = [];
        for(let i = 0; i < nonceBuffer.length; i++){
          if(nonceBuffer[i] != 0){
            non0 = true;
          }
          if(non0){
            val.push(nonceBuffer[i]);
          }
        }
        nonceBuffer = Buffer.from(val);

        const msgEnv = [];
        msgEnv.push(powResult.expiry);
        msgEnv.push(ttl);
        msgEnv.push(topic)
        msgEnv.push(encryptedMessage);
        msgEnv.push(nonceBuffer);

        this.sendEnvelopeToSubscribers(msgEnv);

        const out = [msgEnv];

        const p = rlp.encode(out);

        this.node.rawBroadcast(p);
      }

      if(options.symKey){
        messages.encryptSymmetric(topic, envelope, options, dispatchEnvelope);
      } else {
        messages.encryptAsymmetric(envelope, pubKey, dispatchEnvelope);
      }
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


    this.provider.events.on("addPeer", (url, cb) => {
      const urlParts = url.split("@");
      const ipInfo = urlParts[1].split(":");
    
      const id = Buffer.from(urlParts[0].replace("enode://", ""), "hex");
      const address = ipInfo[0];
      const port = ipInfo[1];
    
      this.node.addStaticPeer({ id, address, port }, (err, data) => {
        if(err){
          cb(err);
        } else {
          cb(null, data);
        }
      });
    });


    // TODO: move this to external file

    const createBloomFilter = (r) => {
      if(r.topics.length > 0){
        return topicsToBloom(r.topics);
      }
      return topicsToBloom(r.topics);
    }

    const BloomFilterSize = 64;

    const topicToBloom = topic => {
      const b = Buffer.alloc(BloomFilterSize, 0);
      const index = Array(3);
      for(let j = 0; j < 3; j++){
        index[j] = int(topic[j])
        if((topic[3] & (1 << j)) != 0) {
          index[j] += 256
        }
      }
      for(let j = 0; j < 3; j++){
        const byteIndex = index[j] / 8;
        const bitIndex = index[j] % 8;
        b[byteIndex] = (1 << uint(bitIndex))
      }
      return b;
    }
    
    const topicsToBloom = (topics) => {
      let i = new Big("0");
      for(let idx = 0; idx < topics.length; idx++){
        const bloom = topicToBloom(topics[idx]);
        // TODO: set i equals to i | bloom
      }
      
      let combined = Buffer.alloc(BloomFilterSize, 0);
      const data = Uint64BE(i).toBuffer();
      combined = Buffer.concat([data, combined.slice(BloomFilterSize - data.length)]);
      return combined;
    }

    const makePayload = (message) => {
      return rlp.encode([message.from, message.to, createBloomFilter(message), message.limit, null, true]);
    }

    this.provider.events.on("requestMessages", (minPow, obj, cb) => {
      const peerId = Buffer.from(obj.mailserverPeer.split("@")[0].replace('enode://', ''), 'hex');
      const peer = this.node.rlpx.getPeers().find(x => x._remoteId.equals(peerId));
      const now = parseInt((new Date()).getTime() / 1000, 10);

      const payload = makePayload(obj);

      const envelope;
      /*
      const envelope = makeEnvelop(
        payload,
        symKey, // Get symkey
        publicKey, // Transalte node to pubkey
        NODEID,
        minPow,
        now
      );
      */



      peer._sendMessage(envelope);

      cb(null, true);
    });

    this.provider.events.on("newKeyPair", (cb) => {
      const id = randomBytes(constants.keyIdLength).toString('hex');

      if(this.keys[id]) return cb("key is not unique");

      const privKey = randomBytes(constants.privKeyLength);
      const pubKey = secp256k1.publicKeyCreate(privKey, false);

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
        pubKey: "0x" + secp256k1.publicKeyCreate(Buffer.from(privKey, "hex"), false).toString('hex')
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
  
  sendEnvelopeToSubscribers(message) {
    console.dir('received message, sending to subscribers...');

    let [expiry, ttl, topic, data, nonce] = message;

    // Preparing data
    nonce = (new Uint64BE(new Big(pow.hexStringToDecString(nonce.toString('hex'))))).toBuffer();
    ttl = (typeof ttl == 'number') ? ttl : parseInt(pow.hexStringToDecString(ttl.toString('hex')), 10);

    const calculatedPow = pow.calculatePoW(expiry, ttl, topic, data, nonce);

    let topicSubscriptions = this.subscriptions['0x' + topic.toString('hex')];
    if (!topicSubscriptions) {
      return;
    }

    let id = keccak256(message.join(''));

    for (let subscriptionId of Object.keys(topicSubscriptions)) {

      const decryptCB = (err, decrypted) => {
        console.dir("--------------");
        if(!decrypted) return;
        // console.dir(decrypted.payload.toString());
        //onsole.dir(decrypted.pubKey.toString('hex'));
        console.dir("--------------");

        this.provider.transmit({
          "jsonrpc": "2.0",
          "method": "shh_subscription",
          "params": {
            subscription: subscriptionId,
            result: {
              sig: "0x" + decrypted.pubKey.toString('hex'),
              // recipientPublicKey: null,
              ttl: ttl,
              timestamp: 1498577270, // TODO: correct value
              topic: "0x" + topic.toString('hex'),
              payload: "0x" + decrypted.payload.toString('hex'),
              //padding: decrypted.padding.toString('hex'),
              padding: null,
              pow: calculatedPow,
              hash: id
            }
          }
        })
        //this.provider.
      }

      console.dir(">>>>> subscription");
      let keyId = topicSubscriptions[subscriptionId].symKeyID;
      if (!keyId) {
        keyId = topicSubscriptions[subscriptionId].privateKeyID;
        let key = Buffer.from(this.keys[keyId].privKey.slice(2), 'hex');
        messages.decryptAsymmetric(key, data, decryptCB);
      } else {
        let key = Buffer.from(this.keys[keyId].symmetricKey.slice(2), 'hex');
        messages.decryptSymmetric(topic, key, data, decryptCB);
      }

    }
    // console.dir(message)
    // TODO: send to clients sbuscribed to this message topic
  }

  listenToNodeEvents() {
    this.node.events.on('shh_message', (message) => {
      this.sendEnvelopeToSubscribers(message);
    })
  }

}

module.exports = Manager;