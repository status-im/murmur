const { randomBytes, pbkdf2 } = require('crypto')
const secp256k1 = require('secp256k1')
const messages = require('./messages.js')
const {keccak256} = require("eth-lib/lib/hash");
const keccak256Buffer = require('js-sha3').keccak256;
const {toBufferBE} = require('bigint-buffer');
const rlp = require('rlp-encoding');
const stripHexPrefix = require('strip-hex-prefix');
const constants = require('./constants');
const Big = require('big.js');
const JSBI = require('jsbi');

function hexStringToDecString(s) {
    function add(x, y) {
        var c = 0, r = [];
        var x = x.split('').map(Number);
        var y = y.split('').map(Number);
        while(x.length || y.length) {
            var s = (x.pop() || 0) + (y.pop() || 0) + c;
            r.unshift(s < 10 ? s : s - 10);
            c = s < 10 ? 0 : 1;
        }
        if(c) r.unshift(c);
        return r.join('');
    }

    var dec = '0';
    s.split('').forEach(function(chr) {
        var n = parseInt(chr, 16);
        for(var t = 8; t; t >>= 1) {
            dec = add(dec, dec);
            if(n & t) dec = add(dec, '1');
        }
    });

    return dec;
  }


  const BYTE1 = 1;       // 0001
  const BYTE2 = 1 << 1;  // 0010
  const BYTE3 = 1 << 2;  // 0100
  const BYTE4 = 1 << 3;  // 1000
  const BYTE5 = 1 << 4;  // 0001
  const BYTE6 = 1 << 5;  // 0010
  const BYTE7 = 1 << 6;  // 0100
  const BYTE8 = 1 << 7;  // 1000


  // Determine the index of the first bit set (BE)
  const firstBitSet = (v) => {
      let byteindex = 0
      for(let i = v.length - 1; i >= 0; i--){
          const byte = v[i];
          if((byte & BYTE1) == 1) return byteindex + 0;
          if((byte & BYTE2) == 2) return byteindex + 1;
          if((byte & BYTE3) == 4) return byteindex + 2;
          if((byte & BYTE4) == 8) return byteindex + 3;
          if((byte & BYTE5) == 16) return byteindex + 4;
          if((byte & BYTE6) == 32) return byteindex + 5;
          if((byte & BYTE7) == 64) return byteindex + 6;
          if((byte & BYTE8) == 128) return byteindex + 7;

          byteindex += 8;
      }
  }



  const powToFirstBit = (pow, data, ttl) => {
    const size = 20 + data.length;
    const res = parseInt(Math.ceil(Math.log2(pow * size * ttl)), 10);
    if(res < 1){
      return 1;
    }
    return res;
  }


  const NS_PER_SEC = 1e9;


  const getTime = () => {
    const t = process.hrtime();
    return t[0] * NS_PER_SEC + t[1];
  }


  // Given a Expiry, TTL, Topic, Nonce and Data Buffer
  // calculate the Pow
  // Useful to validate a envelope
  const calculatePoW = (Expiry, TTL, Topic, Data, Nonce) => {

    let buf = Buffer.allocUnsafe(32).fill(0);
    const h = Buffer.from(keccak256Buffer(rlp.encode([Expiry, TTL, Topic, Data])), 'hex');

    buf = Buffer.concat([h, buf]);
    buf = Buffer.concat([buf.slice(0, buf.length - toBufferBE(Nonce, 8).length), toBufferBE(Nonce, 8)]);

    const d = Buffer.from(keccak256Buffer(buf));
    const size = 20 + Data.length;

    const firstBit = firstBitSet(d);

    let x = (new Big(2)).pow(firstBit)
    x = x.div(new Big(size))
    x = x.div(new Big(TTL));

    return x.toString()
  }



  function ProofOfWork(powTarget, powTime, ttl, topic, data, expiry){
    topic = Buffer.from(stripHexPrefix(topic), 'hex');

    if(powTarget === 0){
      // TODO: Pow is not required
      return {};
    }

    let target;

    if(powTarget === undefined){
      expiry += powTime;
    } else {
      target = powToFirstBit(powTarget, data, ttl);
    }

    let buf = Buffer.alloc(32);
    const h = Buffer.from(keccak256Buffer(rlp.encode([expiry, ttl, topic, data])), 'hex');

    buf = Buffer.concat([h, buf]);

    let bestBit = -1;
    let firstBit;

    let resNonce;

    const finish = JSBI.BigInt(getTime() + powTime * 2 * NS_PER_SEC);

    outerLoop:
    for(let nonce = JSBI.BigInt(0); JSBI.lessThan(getTime(), finish); ){
      for(let i = 0; i < 1024; i++){
        buf = Buffer.concat([buf.slice(0, buf.length - 8), toBufferBE(nonce, 8)]);

        const d = Buffer.from(keccak256Buffer(buf));
        const size = 20 + data.length;
        const firstBit = firstBitSet(d);

        if(firstBit > bestBit){
          resNonce = nonce;
          bestBit = firstBit;
          if(target > 0 && bestBit >= target){
            break outerLoop;
          }
        }
        nonce++
      }
    }

    if(resNonce === undefined){
      // CB
      console.log("Failed to reach the PoW target, specified pow time (%d seconds) was insufficient", powTarget);
      return;
    }

    console.log("Found nonce! " + resNonce);

    return {expiry, target, nonce: resNonce};
  }


  module.exports = {
    hexStringToDecString,
    firstBitSet,
    calculatePoW,
    ProofOfWork
  }
