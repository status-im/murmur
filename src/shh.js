const rlp = require('rlp-encoding');
const Events = require('events');
const constants = require('./constants');

const SHH_STATUS = 0;
const SHH_MESSAGE = 1;
const SHH_BLOOM = 3;
const SHH_P2PMSG = 127;

class SHH {
  constructor(version, peer, send) {
    this.version = version;
    this.peer = peer;
    this.send = send;
    this.events = new Events();
  }

  _handleMessage (code, data) {
    const payload = rlp.decode(data);

    if (code === SHH_STATUS) this.events.emit('status', payload);

    // Bloom filter
    if (code === SHH_BLOOM) this.events.emit('bloom_exchange', payload);

    if (code === SHH_MESSAGE || code === SHH_P2PMSG) {
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

module.exports = {
  default: SHH,
  SHH_BLOOM,
  SHH_MESSAGE,
  SHH_STATUS
};
