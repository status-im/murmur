const rlp = require('rlp-encoding');
const Events = require('events');
const constants = require('./constants');


class SHH {
  constructor(version, peer, send) {
    this.version = version;
    this.peer = peer;
    this.send = send;
    this.events = new Events();
  }

  _handleMessage (code, data) {
    if (code === 0) {
      const payload = rlp.decode(data);
      this.events.emit('status', payload);
    }

    // Bloom filter
    if (code === 3) {
      const payload = rlp.decode(data);
      console.log("Bloom filter: " + payload[0].toString('hex'));
      this.events.emit('bloom_exchange', payload);
    }

    if (code === constants.message || code === constants.p2pMessage) {
      const payload = rlp.decode(data);
      // console.dir("whisper received message")
      // console.dir("contains " + payload.length + " envelopes")

      payload.forEach((envelope) => {
        // TODO: replace with envelope or decrypted fields, whatever abstraction makes more sense
        const peer = "enode://" + this.peer._remoteId.toString('hex') + "@" + this.peer._socket._peername.address + ":" + this.peer._socket._peername.port;
        this.events.emit('message', envelope, peer);
      });
    }
  }

  sendMessage (code, payload) {
    this.send(code, rlp.encode(payload));
  }

  sendRawMessage(code, payload) {
    this.send(code, payload);
  }

}

module.exports = SHH;
