const devp2p = require('ethereumjs-devp2p');
const rlp = require('rlp-encoding');
const Events = require('events');
const messages = require('./messages.js');
const { SHA3 } = require('sha3');

function short_rlp(envelope) {
  let [expiry, ttl, topic, data, nonce] = envelope;
  return rlp.encode([expiry, ttl, topic, data])
}

function pow_hash(envelope, env_nonce) {
  let short_rlp_envelope = short_rlp(envelope)
  //console.dir(short_rlp_envelope);
  return SHA3.SHA3Hash().update(Buffer.concat([short_rlp_envelope, env_nonce])).digest('hex');
}

function pow(pow_hash_value, size, ttl) {
  return 2**(leading_zeros(pow_hash_value)) / (size * ttl)
}

class SHH {
  constructor(version, peer, send) {
    this.version = version;
    this.peer = peer;
    this.send = send;
    this.events = new Events();
  }

  _handleMessage (code, data) {
    console.dir("----- whisper handleMessage")
    console.dir(code)

    if (code === 0) {
      const payload = rlp.decode(data)
      console.dir("whisper status")
      console.dir("version: " + payload[0].toString('hex'))
      console.dir("something: " + payload[1].toString('hex'))
      this.sendMessage(code, payload)
    }
    if (code === 1) {
      const payload = rlp.decode(data)
      console.dir("whisper received message")
      console.dir("contains " + payload.length + " envelopes")

      payload.forEach((envelope) => {
        let [expiry, ttl, topic, data, nonce] = envelope;

        console.dir("--------------------")
        console.dir("expiry: " + devp2p._util.buffer2int(expiry))
        console.dir("ttl: " + devp2p._util.buffer2int(ttl))
        console.dir("topic: " + topic.toString('hex'))
        console.dir("data (size): " + data.length)
        console.dir("nonce: " + devp2p._util.buffer2int(nonce))

        console.dir("topic buffer")
        console.dir(topic)
        console.dir("topic hex")
        let topicHex = topic.toString('hex')
        console.dir(topicHex)
        console.dir("topic rebuild")
        console.dir(messages.hexToBytes(topicHex))

        console.dir("-----------------------")
        console.dir("----  POW ----")
        console.dir(nonce);
        let powHash = (pow_hash(envelope, nonce))
        console.dir(powHash)
        console.dir(messages.hexToBytes(powHash)[0].toString(2))
        // TODO: temporary, this is NOT the right way to do it
        let leadingZeros = (8 - messages.hexToBytes(powHash)[0].toString(2).length)
        console.dir(leadingZeros)
        console.dir("-----------------------")

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

}

module.exports = SHH;
