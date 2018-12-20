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
    // console.dir("----- whisper handleMessage")
    // console.dir(code)
    if (code === 0) {
      const payload = rlp.decode(data);
     // console.dir("whisper status")
      //console.dir("version: " + payload[0].toString('hex'))
     // console.dir("something: " + payload[1].toString('hex'))
      this.sendMessage(code, payload);
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
