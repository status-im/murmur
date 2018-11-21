const crypto = require('crypto')
const Events = require('events')
const constants = require('./constants');
const stripHexPrefix = require('strip-hex-prefix');
const EC = require('elliptic').ec;

// TODO: verify visibility
const symKeys = new Object();
const privateKeys = new Object();

const ec = new EC('secp256k1');

class Provider {

  constructor() {
    this.powTarget = 12.5;
    this.maxMessageSize = 2000;
    this.events = new Events();
  }

  send(payload, callback) {
    return this.sendAsync(payload, callback);
  }

  sendAsync(payload, callback) {
    console.log('payload method is ', payload.method);

    let method = this[payload.method].bind(this);
    if (method) {
      return method.call(method, payload, (err, result) => {
        if (err) {
          return callback(err)
        }
        let response = {'id': payload.id, 'jsonrpc': '2.0', 'result': result};
        callback(null, response);
      })
    }
    callback(new Error('unknown method ' + payload.method));
  }

  shh_version(payload, cb) {
    cb(null, "6.0");
  }

  shh_info(payload, cb) {
    let result = {
      "minPow": this.powTarget,
      "maxMessageSize": this.maxMessageSize,
      "memory": 10000,
      "messages": 20,
    };

    cb(null, result);
  }

  shh_setMaxMessageSize(payload, cb) {
    this.maxMessageSize = payload.params[0];

    cb(null, true);
  }

  shh_setMinPoW(payload, cb) {
    this.powTarget = payload.params[0];

    cb(null, true);
  }

  shh_markTrustedPeer(payload, cb) {
    throw new Error("shh_markTrustedPeer not implemented yet");
    cb(null, false);
  }

  shh_newKeyPair(payload, cb) {
    crypto.randomBytes(constants.keyIdLength, (err, buf) => {
      if (err) return cb(err);

      const id = buf.toString('hex');
      
      if(privateKeys[id]){
        return cb("Key is not unique");
      }

      const key = ec.genKeyPair();

      privateKeys[id] = Buffer.from(key.getPrivate().toString('hex'), 'hex')

      cb (null, id);
    });
  }

  shh_addPrivateKey(payload, cb) {
    const key = Buffer.from(stripHexPrefix(payload.params[0]), 'hex');
    
    crypto.randomBytes(constants.keyIdLength, (err, buf) => {
      if (err) return cb(err);

      const id = buf.toString('hex');
      
      if(privateKeys[id]){
        return cb("Key is not unique");
      }

      privateKeys[id] = key;

      cb(null, id);
    });
  }

  shh_deleteKeyPair(payload, cb) {
    const id = payload.params[0];
    if(id.length / 2 != constants.keyIdLength){
      const errMsg = "Invalid id";
      return cb(errMsg);
    }

    if(privateKeys[id]){
      delete privateKeys[id];
      cb(null, true);
    } else {
      cb(null, false);
    }
  }

  shh_hasKeyPair(payload, cb) {
    const id = payload.params[0];
    cb(null, !!privateKeys[id]);
  }

  shh_getPublicKey(payload, cb) {
    const id = payload.params[0];
    
    if(id.length / 2 != constants.keyIdLength){
      const errMsg = "Invalid id";
      return cb(errMsg);
    }

    if(privateKeys[id]){
      const pubKey = "0x" + ec.keyFromPrivate(privateKeys[id]).getPublic().encode('hex');
      cb(null, pubKey);
    } else {
      cb("Key not found");
    }
  }

  shh_getPrivateKey(payload, cb) {
    const id = payload.params[0];
    
    if(id.length / 2 != constants.keyIdLength){
      const errMsg = "Invalid id";
      return cb(errMsg);
    }

    if(privateKeys[id]){
      cb(null, "0x" + symKeys[id].toString('hex'));
    } else {
      cb("Key not found");
    }
  }

  shh_newSymKey(payload, cb) {
    crypto.randomBytes(constants.symKeyLength, (err, keyBuf) => {
      if (err) return cb(err);

      crypto.randomBytes(constants.keyIdLength, (err, idBuf) => {
        if (err) return cb(err);

        const id = idBuf.toString('hex');

        if(symKeys[id]){
          return cb("Key is not unique");
        }
  
        symKeys[id] = keyBuf;

        cb(null, id);
      });
    });
  }

  shh_addSymKey(payload, cb) {
    const key = Buffer.from(stripHexPrefix(payload.params[0]), 'hex');
    
    if(key.length != constants.symKeyLength){
      cb("Wrong key size");
    }

    crypto.randomBytes(constants.keyIdLength, (err, buf) => {
      if (err) return cb(err);

      const id = buf.toString('hex');
      
      if(symKeys[id]){
        return cb("Key is not unique");
      }

      symKeys[id] = key;

      cb(null, id);
    });
  }

  shh_generateSymKeyFromPassword(payload, cb) {
    let password = payload.params[0];

    crypto.randomBytes(constants.keyIdLength, (err, buf) => {
      if (err) return cb(err);

      const id = buf.toString('hex');
      
      if(symKeys[id]){
        return cb("Key is not unique");
      }

      crypto.pbkdf2(password, "", 65356, constants.symKeyLength, 'sha256', (err, derivedKey) => {
        if (err) return cb(err);

        symKeys[id] = derivedKey;

        cb (null, id);
      });
    });
  }
   
  shh_hasSymKey(payload, cb) {
    const id = payload.params[0];
    cb(null, !!symKeys[id]);
  }

  shh_getSymKey(payload, cb) {
    const id = payload.params[0];
    
    if(id.length / 2 != constants.keyIdLength){
      const errMsg = "Invalid id";
      return cb(errMsg);
    }

    if(symKeys[id]){
      cb(null, "0x" + symKeys[id].toString('hex'));
    } else {
      cb("Key not found");
    }
  }

  shh_deleteSymKey(payload, cb) {
    const id = payload.params[0];
    if(id.length / 2 != constants.keyIdLength){
      const errMsg = "Invalid id";
      return cb(errMsg);
    }

    if(symKeys[id]){
      delete symKeys[id];
      cb(null, true);
    } else {
      cb(null, false);
    }
  }

  shh_subscribe(payload, cb) {
    if (payload.params[0] !== "messages") {
      return cb("unknonw payload type "+ payload.params[0]);
    }
    this.events.emit('subscribe', payload.params[1], cb)
  }

  shh_unsubscribe(payload, cb) {
    throw new Error("shh_unsubscribe not implemented yet");
    cb(null, false);
  }

  shh_newMessageFilter(payload, cb) {
    throw new Error("shh_newMessageFilter not implemented yet");
    cb(null, false);
  }

  shh_deleteMessageFilter(payload, cb) {
    throw new Error("shh_deleteMessageFilter not implemented yet");
    cb(null, false);
  }

  shh_getFilterMessages(payload, cb) {
    throw new Error("shh_getFilterMessages not implemented yet");
    cb(null, false);
  }

  shh_post(payload, cb) {
    this.events.emit('post', payload.params[0]);
    cb(null, true);
  }

}

module.exports = Provider;
