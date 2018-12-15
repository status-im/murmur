const rlp = require('rlp-encoding');
const Events = require('events');
const messages = require('./messages.js');


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
      const payload = rlp.decode(data)
     // console.dir("whisper status")
      //console.dir("version: " + payload[0].toString('hex'))
     // console.dir("something: " + payload[1].toString('hex'))
      this.sendMessage(code, payload)
    }
    if (code === 1 || code === 127) { // TODO: extract to constant. 127 is p2p message
      const payload = rlp.decode(data)
      // console.dir("whisper received message")
      // console.dir("contains " + payload.length + " envelopes")

      payload.forEach((envelope) => {
        let [expiry, ttl, topic, data, nonce] = envelope;
      
/*
        console.dir("--------------------")
        console.dir("expiry: " + devp2p._util.buffer2int(expiry))
        console.dir("ttl: " + devp2p._util.buffer2int(ttl))
        console.dir("topic: " + topic.toString('hex'))
        console.dir("data (size): " + data.length)
        console.dir("nonce: " + devp2p._util.buffer2int(nonce))
*/
      
        // TODO: replace with envelope or decrypted fields, whatever abstraction makes more sense
        this.events.emit('message', envelope)
      })
    }
  }

  isTooOld(ttl) {
    // TODO:
    return false;
  }

  sendMessage (code, payload) {
    this.send(code, rlp.encode(payload))
  }

  sendRawMessage(code, payload) {
    this.send(code, payload)
  }

}

module.exports = SHH;
