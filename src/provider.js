const crypto = require('crypto')
const Events = require('events')

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
    this.events.emit('newKeyPair', cb)
  }

  shh_addPrivateKey(payload, cb) {
    throw new Error("shh_addPrivateKey not implemented yet");
    cb(null, false);
  }

  shh_deleteKeyPair(payload, cb) {
    throw new Error("shh_deleteKeyPair not implemented yet");
    cb(null, false);
  }

  shh_hasKeyPair(payload, cb) {
    throw new Error("shh_hasKeyPair not implemented yet");
    cb(null, false);
  }

  shh_getPublicKey(payload, cb) {
    const id = payload.params[0];
    this.events.emit("getPublicKey", id, cb)
  }

  shh_getPrivateKey(payload, cb) {
    const id = payload.params[0];
    this.events.emit("getPrivateKey", id, cb)
  }

  shh_newSymKey(payload, cb) {
    throw new Error("shh_newSymKey not implemented yet");
    cb(null, false);
  }

  shh_addSymKey(payload, cb) {
    throw new Error("shh_addSymKey not implemented yet");
    cb(null, false);
  }

  shh_generateSymKeyFromPassword(payload, cb) {
    let password = payload.params[0];

    crypto.pbkdf2(password, "", 65356, 32, 'sha256', (err, derivedKey) => {
      if (err) { return cb(err) }
      cb (null, derivedKey.toString('hex'));
    });
  }

  shh_hasSymKey(payload, cb) {
    throw new Error("shh_hasSymKey not implemented yet");
    cb(null, false);
  }

  shh_getSymKey(payload, cb) {
    throw new Error("shh_getSymKey not implemented yet");
    cb(null, false);
  }

  shh_deleteSymKey(payload, cb) {
    throw new Error("shh_deleteSymKey not implemented yet");
    cb(null, false);
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
