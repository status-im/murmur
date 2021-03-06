const { randomBytes, pbkdf2 } = require('crypto-browserify');
const secp256k1 = require('secp256k1');
const messages = require('./messages.js');
const rlp = require('rlp-encoding');
const stripHexPrefix = require('strip-hex-prefix');
const constants = require('./constants');
const pow = require('./pow');
const Big = require('big.js');
const Uint64BE = require("int64-buffer").Uint64BE;
const {createBloomFilter, bloomFilterMatch, topicToBloom, bloomFilterAddition} = require('./bloom');
const BloomFilterManager = require('./bloom').default;
const MessageTracker = require('./message-tracker');
const Envelope = require("./envelope");
const config = require('../data/config.json');

class Manager {

  constructor(provider, options) {
    this.provider = provider;
    this.options = options;
    this.keys = {};
    this.subscriptions = {};
    this.mailserverSubscriptions = {};

    this.messagesTracker = new MessageTracker();
    this.bloomManager = new BloomFilterManager(options.ignoreBloomFilters);
  }

  executeOnReady(cb){
    this.onReadyCB = cb;
  }

  setupNodes(nodes){
    this.nodes = nodes;
    nodes.map(n => {
      n.setTracker(this.messagesTracker);
      n.setBloomManager(this.bloomManager);
    });
  }

  start(){   
     this.listenToProviderEvents();
     this.listenToNodeEvents();
  }

  getNode(protocol) {
    return this.nodes.find(x => x.type === protocol);
  }

  isReady(protocol){
    this.getNode(protocol).ready = true;
    if(!this.nodes.filter(x => !x.ready).length){
      console.log("Murmur ready");
      if(this.onReadyCB) this.onReadyCB();
    }
  }

  listenToProviderEvents() {
    this.provider.events.on('post', (payload, cb) => {
      let {
        symKeyID,
        pubKey,
        sig,
        ttl,
        topic,
        padding,
        powTime,
        powTarget,
        targetPeer,
        libp2pPeer
      } = payload;

      let messagePayload = Buffer.from(stripHexPrefix(payload.payload), 'hex');

      topic = Buffer.from(stripHexPrefix(topic), 'hex');

      if(ttl === 0){
        ttl = 50; // Default TTL
      }

      const options = {};

      const expiry = Math.floor((new Date()).getTime() / 1000.0) + ttl;

      if(!!sig){
        if(Buffer.isBuffer(sig)){
          options.from = { privKey: "0x" + sig.toString('hex') };
        } else {
          options.from = this.keys[sig];
          if(!options.from || !options.from.privKey){
            return cb("No identity found");
          }
        }
      }

      if(pubKey && symKeyID) return cb("Either symKeyID or pubKey should be specified, not both");

      // Set symmetric key that is used to encrypt the message
      if(!!symKeyID){
        if(!topic) return cb("Topic is required");        
        if(topic.length > 4) return cb("Topic length is incorrect");
        
        options.symKey = this.keys[symKeyID];
        if (!options.symKey || !options.symKey.symmetricKey) return cb("No symmetric key found");
        if(!messages.validateDataIntegrity(Buffer.from(stripHexPrefix(options.symKey.symmetricKey), "hex"), constants.symKeyLength)) return cb("Invalid symmetric key");
      } else {
        if(!pubKey) return cb("Pubkey is required");
        if(!stripHexPrefix(pubKey).match(/^[0-9A-Fa-f]{130}$/)) return cb("Invalid pubkey");
      }

      let  envelope = messages.buildMessage(messagePayload, padding, sig, options, (err) => {
        if(err) console.log(err);
      });

      const dispatchEnvelope = callback => (err, encryptedMessage) => {
        if(err){
          console.error(err);
          return cb("Error encrypting message");
        }

        const powResult = pow.ProofOfWork(powTarget, powTime, ttl, topic, encryptedMessage, expiry);

        let nonceBuffer =  powResult.nonce;
        let non0 = false;
        let val = [];
        for(let i = 0; i < nonceBuffer.length; i++){
          if(nonceBuffer[i] !== 0){
            non0 = true;
          }
          if(non0){
            val.push(nonceBuffer[i]);
          }
        }
        nonceBuffer = Buffer.from(val);

        const msgEnv = [];

        const expiryB = Buffer.alloc(4);
              expiryB.writeUInt32BE(powResult.expiry);
        const ttlB = Buffer.alloc(1);
              ttlB.writeUInt8(ttl);

        msgEnv.push(expiryB);
        msgEnv.push(ttlB);
        msgEnv.push(topic);
        msgEnv.push(encryptedMessage);
        msgEnv.push(nonceBuffer);

        const envelope = new Envelope(msgEnv);

        const devp2p = this.getNode('devp2p');
        const libp2p = this.getNode('libp2p');

        if(targetPeer){
          if(libp2pPeer && libp2p){
            libp2p.broadcast(msgEnv, libp2pPeer, constants.SHH_P2PREQ);
          } else if(devp2p) {
            devp2p.broadcast(msgEnv, targetPeer.toString('hex'), constants.SHH_P2PREQ);
          }
        } else {

          if(devp2p) {
           devp2p.broadcast(envelope);
           this.messagesTracker.push(envelope, 'devp2p');
          }
          if(libp2p){
            libp2p.broadcast(envelope);
            this.messagesTracker.push(envelope, 'libp2p');
          }

          callback(null, stripHexPrefix(envelope.id));
          this.sendEnvelopeToSubscribers(envelope);
        }
      
      };

      if(options.symKey){
        messages.encryptSymmetric(topic, envelope, options, dispatchEnvelope(cb));
      } else {
        messages.encryptAsymmetric(envelope, pubKey, dispatchEnvelope(cb));
      }
    });

    // TODO: this needs to refactored to take into account different clients
    this.provider.events.on('subscribe', (payload, cb) => {
      let { _minPow, symKeyID, privateKeyID, topics, _allowP2P } = payload;
      const id = randomBytes(constants.keyIdLength).toString('hex');

      topics = topics || [];

      this.bloomManager.emit('updateFilter', topics);

      if(!topics.length){
        if(!this.subscriptions['all']) this.subscriptions['all'] = {};
        this.subscriptions['all'][id] = {
          privateKeyID,
          symKeyID
        };
      } else {
        for (let topic of topics) {
          if (!this.subscriptions[topic]) {
            this.subscriptions[topic] = {};
          }
          this.subscriptions[topic][id] = {
            privateKeyID,
            symKeyID
          };
        }
      }

      cb(null, id);
    });


    this.provider.events.on("markTrustedPeer", (peer) => {
      let protocol = "devp2p";
      if(peer.startsWith("libp2p:")){
        protocol = "libp2p";
        peer = peer.replace(protocol + ":", "");
      }
      if(this.getNode(protocol)) this.getNode(protocol).addTrustedPeer(peer);
    });

    
    this.provider.events.on("addPeer", (url, cb) => {
      const urlParts = url.split("@");
      const ipInfo = urlParts[1].split(":");

      const id = Buffer.from(urlParts[0].replace("enode://", ""), "hex");
      const address = ipInfo[0];
      const port = ipInfo[1];

      if(this.getNode('devp2p')){
        this.getNode('devp2p').addStaticPeer({ id, address, port }, (err, data) => {
        if(err){
          cb(err);
        } else {
          cb(null, data);
        }
      });
    } else {
      cb(null, true);
    }

    });

    this.provider.events.on("requestMessages", (minPow, message, cb) => {
      let peerId = Buffer.from(message.mailserverPeer.split("@")[0].replace('enode://', ''), 'hex');
      const now = parseInt((new Date()).getTime() / 1000, 10);

      if(!message.to) message.to = now;
      if(!message.from)  message.from = now - 86400; // -24hr
      if(!message.timeout) message.timeout = 30;

      const bloom = message.bloom ? message.bloom : createBloomFilter(message);

      let payloadArr = [message.from, message.to, bloom, message.limit, null, 1];
      if(message.bridgePeerId){
        payloadArr.push(message.mailserverPeer);
      }
      
      const payload = rlp.encode(payloadArr);

      let publicKey = null;
      if(!message.symKeyID){
        publicKey = Buffer.concat([Buffer.from(4), Buffer.from(peerId, 'hex')]);
      }

      let privateKey;
      if(this.getNode('devp2p')){
        privateKey = this.getNode('devp2p').privateKey;
      } else {
        // Placeholder since it will be the bridge that will request the messages
        privateKey = randomBytes(constants.privKeyLength);
      }

      const envelope = {
        symKeyID: message.symKeyID,
        pubKey: publicKey,
        sig: privateKey,
        ttl: 50,
        topic: "0x00000000",
        powTime: 1, //  TODO: If using default time of 5 secs, peer will disconnect. PoW needs to happen in a separate thread
        powTarget: minPow,
        payload: payload,
        targetPeer: peerId
      };

      if(message.bridgePeerId){
        envelope.libp2pPeer = message.bridgePeerId;
      }
        
      this.provider.events.emit('post', envelope, cb);
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
      if(id.length / 2 !== constants.keyIdLength){
        const errMsg = "invalid id";
        return cb(errMsg);
      }

      if(this.keys[id]){
        delete this.keys[id];
        cb(null, true);
      } else {
        cb(null, false);
      }
    };

    this.provider.events.on("deleteKeyPair", (id, cb) => {
      deleteKey(id, cb);
    });

    this.provider.events.on("addSymKey", (symmetricKey, cb) => {
      const id = randomBytes(constants.keyIdLength).toString('hex');

      if(this.keys[id]) return cb("key is not unique");

      if(stripHexPrefix(symmetricKey).length / 2 !== constants.symKeyLength){
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

        cb(null, id);
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

  sendEnvelopeToSubscribers(envelope) {
    if(this.messagesTracker.isSent(envelope)) return;

    //console.dir('received message, sending to subscribers...');
    
    // Preparing data
    // TODO: this data preparation could be part of envelope?
    const nonce = (new Uint64BE(new Big(pow.hexStringToDecString(envelope.nonce.toString('hex'))))).toBuffer();
    const ttl = (typeof envelope.ttl === 'number') ? envelope.ttl : parseInt(pow.hexStringToDecString(envelope.ttl.toString('hex')), 10);
    
    const calculatedPow = pow.calculatePoW(envelope.expiry, ttl, envelope.topic, envelope.data, nonce);

    let topicSubscriptions = this.subscriptions['0x' + envelope.topic.toString('hex')] || {};
    let all = this.subscriptions['all'] || {};

    topicSubscriptions = Object.assign(topicSubscriptions, all);

    if (!topicSubscriptions) return;

    for (let subscriptionId of Object.keys(topicSubscriptions)) {

      const decryptCB = (err, decrypted) => {
        if(!decrypted) return;
        // console.dir(decrypted.payload.toString());
        //onsole.dir(decrypted.pubKey.toString('hex'));

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
              topic: "0x" + envelope.topic.toString('hex'),
              payload: "0x" + decrypted.payload.toString('hex'),
              //padding: decrypted.padding.toString('hex'),
              padding: null,
              pow: calculatedPow,
              hash: envelope.id
            }
          }
        });
      };

     // console.dir(">>>>> subscription");
      try {
        let keyId = topicSubscriptions[subscriptionId].symKeyID;
        if (!keyId) {
          keyId = topicSubscriptions[subscriptionId].privateKeyID;
          if(this.keys[keyId]){
            let key = Buffer.from(this.keys[keyId].privKey.slice(2), 'hex');
            messages.decryptAsymmetric(key, envelope.data, decryptCB);
          }
        } else {
          let key = Buffer.from(this.keys[keyId].symmetricKey.slice(2), 'hex');
          messages.decryptSymmetric(envelope.topic, key, envelope.data, decryptCB);
        }
      } catch(e) {
        //
      }
    }
  }

  listenToNodeEvents() {
    const isBridge = this.options.isBridge;

    const handleMessage = protocol => envelope => {
      this.messagesTracker.push(envelope, protocol);
      if(isBridge) this.getNode(protocol).broadcast(envelope);
      this.sendEnvelopeToSubscribers(envelope); 
    };

    if(this.getNode('devp2p')) {
      this.getNode('devp2p').events.on('ready', () => { this.isReady('devp2p'); });
      this.getNode('devp2p').events.on('shh_message', handleMessage('libp2p'));
      this.getNode('devp2p').events.on('shh_old_message', (envelope, originator) => {
        this.sendEnvelopeToSubscribers(envelope); 
        if(isBridge) this.bridgeMailserverMessages(originator, envelope);
       });
    }

    if(this.getNode('libp2p')) {
      this.getNode('libp2p').events.on('ready', () => { this.isReady('libp2p'); });
      this.getNode('libp2p').events.on('shh_message', handleMessage('devp2p'));
      if(isBridge) this.bridgeMailserverRequests();
    }
  }


  bridgeMailserverMessages(originator, envelope) {
    if (!this.mailserverSubscriptions[originator]) return;
    Object.keys(this.mailserverSubscriptions[originator]).forEach(peer => {
      if (bloomFilterMatch(this.mailserverSubscriptions[originator][peer], topicToBloom(envelope.topic))) {
        this.getNode('libp2p').broadcast(envelope, peer);
      }
    });
  }

  bridgeMailserverRequests(){
    this.provider.events.emit("generateSymKeyFromPassword", config.mailserverPassword, (err, symKeyID) => {
      this.getNode('libp2p').events.on("shh_bridge_mailserver_request", (envelope, peerId) => {
       const key = Buffer.from(stripHexPrefix(this.keys[symKeyID].symmetricKey), "hex"); 
       messages.decryptSymmetric(envelope.topic, key, envelope.data, (err, decrypted) => {
         if(!decrypted) return;
     
         const message = rlp.decode(decrypted.payload);
         const bloom = message[2];
         const mailserverPeer = message[6].toString();

         const params = {
           from: message[0].readUInt32BE(0),
           to: message[1].readUInt32BE(0),
           bloom: message[2],
           limit: Buffer.from([]),
           mailserverPeer,
           symKeyID
         };

         if(!this.mailserverSubscriptions[mailserverPeer]) this.mailserverSubscriptions[mailserverPeer] = {};
         if(!this.mailserverSubscriptions[mailserverPeer][peerId]) this.mailserverSubscriptions[mailserverPeer][peerId] = Buffer.from([]);

         this.mailserverSubscriptions[mailserverPeer][peerId] = bloomFilterAddition(this.mailserverSubscriptions[mailserverPeer][peerId], bloom);
         
         if(this.getNode('devp2p')){                    // TODO: minPow
           this.provider.events.emit("requestMessages", 0.002, params, err => {
             if(err) console.error("Error bridging mailserver request: " + err.message);
           });
         }
       });
      });
    });
  }

}

module.exports = Manager;
