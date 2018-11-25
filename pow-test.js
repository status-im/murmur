const keccak256Buffer = require('js-sha3').keccak256;
const rlp = require('rlp-encoding');
const stripHexPrefix = require('strip-hex-prefix');
const {toBufferBE} = require('bigint-buffer');


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


function ProofOfWork(powTarget, powTime, ttl, topic, data, expiry){
  topic = Buffer.from(stripHexPrefix(topic), 'hex');

  if(powTarget === 0){
    // Pow is not required
    return {};
  } 

  let target;

  if(powTarget === undefined){
    expiry += powTime;
  } else {
    target = powToFirstBit(powTarget, data, ttl);
  }

  let buf = Buffer.allocUnsafe(32).fill(0);
  const h = Buffer.from(keccak256Buffer(rlp.encode([expiry, ttl, topic, data])), 'hex');
  
  buf = Buffer.concat([h, buf]);

  let bestBit = -1;
  let firstBit;

  let resNonce; 
  
  
  const finish = getTime() + powTime * 10 * NS_PER_SEC;
  
  outerLoop: 
  for(let nonce = BigInt(0); getTime() < finish; ){
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
  } else {
    console.log("Found nonce! " + resNonce)
  }
  
  return {expiry, target, nonce: resNonce};
}



const powTarget = 0.002;
const powTime = 1;
const ttl = 10;
const topic = "0x27ee704f";
const data = Buffer.from("48656c6c6f39b5ed9a3de73910c6e50a5c2683bda932d5d7d8e07ba239754fee69015074584773517385e16a6b58bc4d181f5593079d9195a4d23414bff013c7704b0b39e484b5d07c549dc2beefae53db01aaaf1c4f3481aae7d63bf63fdfd780af59a60180e462c33e827712f627b62d70061d99ef8617ee9ac6a2a019a48ca7f9f5bd035444ad647e2d54fdf536da21595dd8c04e22368992f9aabcc115be70467bc3ce2953809867e3f4ca15fae1738666e510bc0c59be63814f2c5332b8beda3eaafd1273f945ea0b2c8ef6c31c27e8e4e1905a5494c03a836f3239e8153f128f53785209944763d3d3fa38d944c4201a81fec261c1e907a98941812c3fa9e8bd0c3bf119342d939f8e9668711790479381fae91ca24fcf154a75b6de19c820476f7068657221", "hex");
const expiry = 1543199247;

console.log(ProofOfWork(powTarget, powTime, ttl, topic, data, expiry))