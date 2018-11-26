const Events = require('events')

class Provider {

  constructor() {
    this.powTarget = 12.5;
    this.maxMessageSize = 2000;
    this.events = new Events();
    this.notificationCallbacks = [];
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
    this.events.emit('newKeyPair', cb);
  }

  shh_addPrivateKey(payload, cb) {
    if (!payload.params[0]) {
      return cb("private key is required");
    }

    this.events.emit('addPrivateKey', payload.params[0], cb);
  }

  shh_deleteKeyPair(payload, cb) {
    if (!payload.params[0]) {
      return cb("key id is required");
    }

    this.events.emit('deleteKeyPair', payload.params[0], cb);
  }

  shh_hasKeyPair(payload, cb) {
    if (!payload.params[0]) {
      return cb("key id is required");
    }

    this.events.emit('hasKeyPair', payload.params[0], cb);
  }

  shh_getPublicKey(payload, cb) {
    if (!payload.params[0]) {
      return cb("key id is required");
    }

    this.events.emit('getPublicKey', payload.params[0], cb);
  }

  shh_getPrivateKey(payload, cb) {
    if (!payload.params[0]) {
      return cb("key id is required");
    }

    this.events.emit('getPrivateKey', payload.params[0], cb);
  }

  shh_newSymKey(payload, cb) {
    this.events.emit('newSymKey', cb);
  }

  shh_addSymKey(payload, cb) {
    if (!payload.params[0]) {
      return cb("symmetric key is required");
    }

    this.events.emit('addSymKey', payload.params[0], cb);
  }

  shh_generateSymKeyFromPassword(payload, cb) {
    if (!payload.params[0]) {
      return cb("password is required");
    }

    this.events.emit('generateSymKeyFromPassword', payload.params[0], cb);
  }
   
  shh_hasSymKey(payload, cb) {
    if (!payload.params[0]) {
      return cb("key id is required");
    }

    this.events.emit('hasSymKey', payload.params[0], cb);
  }

  shh_getSymKey(payload, cb) {
    if (!payload.params[0]) {
      return cb("key id is required");
    }

    this.events.emit('getSymKey', payload.params[0], cb);
  }

  shh_deleteSymKey(payload, cb) {
    if (!payload.params[0]) {
      return cb("key id is required");
    }

    this.events.emit('deleteSymKey', payload.params[0], cb);
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

  on(type, cb) {
    // TODO: support other types later, if relevant
    if (type !== 'data') return;
    this.notificationCallbacks.push(cb)
  }

  transmit(result) {
    this.notificationCallbacks.forEach((callback) => {
      callback(result);
    });
  }

}

module.exports = Provider;
