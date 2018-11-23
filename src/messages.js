const crypto = require('crypto');
const gcm = require('node-aes-gcm');
const elliptic = require("elliptic");
const secp256k1 = new elliptic.ec("secp256k1");
const {keccak256} = require("eth-lib/lib/hash");
const {slice, length, toNumber} = require("eth-lib/lib/bytes");
const constants = require('./constants');


/**
 * Convert a hex string to a byte array
 * Note: Implementation from crypto-js
 * @method hexToBytes
 * @param {string} hex
 * @return {Array} the byte array
 */
const hexToBytes = (hex) => {
  hex = hex.toString(16);
  hex = hex.replace(/^0x/i,'');
  let bytes = [];
  for (let c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
};

const assignDefined = (target, ...sources) => {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const val = source[key];
      if (val !== undefined) {
        target[key] = val;
      }
    }
  }
  return target;
}

const kdf = (hashName, z, s1, kdLen, cb) => {
  const BlockSize = 64;
  // --
  const reps =  ((kdLen + 7) * 8) / (BlockSize * 8)
  if(reps > Math.pow(2,32) - 1) {
    cb("Data too long");
    return;
  }
  
  let counter = Buffer.from([0,0,0,1]);
  let k = Buffer.from([]);

  for(let i = 0; i <= reps; i++){
    const hash = crypto.createHash(hashName);
    hash.update(Buffer.from(counter));
    hash.update(z); // 
    hash.update(s1);
    k = Buffer.concat([k, hash.digest()]);
    counter[3]++;
  }
  
  return k.slice(0, 32);
}

const symDecrypt = (ct, ke, mEnd) => {
  const blSize = 16;
  const iv = ct.slice(0, blSize);
  const ciphertext = ct.slice(blSize);

  var cipher = crypto.createDecipheriv("aes-128-ctr", ke, iv);
  var firstChunk = cipher.update(ciphertext);
  var secondChunk = cipher.final();
    
  return (Buffer.concat([firstChunk, secondChunk]));
} 

// From parity ECIES
// Compare two buffers in constant time to prevent timing attacks.
function equalConstTime(b1, b2) {
  if (b1.length !== b2.length) {
    return false;
  }
  var res = 0;
  for (var i = 0; i < b1.length; i++) {
    res |= b1[i] ^ b2[i];  // jshint ignore:line
  }
  return res === 0;
}

const decryptAsymmetric = (key, data, cb) => {
  const privKey = crypto.createECDH('secp256k1');
  privKey.setPrivateKey(key);
  
  const z = privKey.computeSecret(data.slice(0, 65));

  const k = kdf("sha256", z, Buffer.from([]), 32)
  if(k === null) return;

  const keyLen = 16;
  const ke = k.slice(0, keyLen);
  let km = k.slice(keyLen);
  km = crypto.createHash("sha256").update(km).digest();
 
  const hashSize = 32;
  const mEnd = data.length - hashSize;
  const ct = data.slice(65, mEnd);

  // Message Tag
  const messageTag = crypto.createHmac('sha256', km).update(ct).update("").digest();

  if(!equalConstTime(messageTag, data.slice(mEnd))){
    return cb("Invalid Message");
  }

  const decrypted = symDecrypt(ct, ke, mEnd);

  const msgObj = parseMessage(decrypted);

  cb(null, msgObj);
}

const decryptSymmetric = (topic, key, data, cb) => {
  crypto.pbkdf2(topic, Buffer.from([]), 65536, constants.aesNonceLength, 'sha256', (err, iv) => {
    if (err) {
      if(cb) return cb(err);
      throw err;
    }

    if (data.length < constants.aesNonceLength) {
      const errorMsg = "missing salt or invalid payload in symmetric message";
      if(cb) return cb(errorMsg);
      throw errorMsg;
    }

    const salt = data.slice(data.length - constants.aesNonceLength);
    const msg = data.slice(0, data.length - 28);
    const decrypted = gcm.decrypt(key, salt, msg, Buffer.from([]), constants.dummyAuthTag);

    const msgObj = parseMessage(decrypted.plaintext);

    cb(null, msgObj);
  });
}

const parseMessage = (message) => {
  let start = 1;
  const end = message.byteLength;

  let payload;
  let pubKey;

  const auxiliaryFieldSize = message.readUIntLE(0, 1) & constants.flagMask;

  let auxiliaryField;
  if(auxiliaryFieldSize !== 0) {
    auxiliaryField = message.readUIntLE(start, auxiliaryFieldSize);
    start += auxiliaryFieldSize;
    payload = message.slice(start, start + auxiliaryField);
  }

  const isSigned = (message.readUIntLE(0, 1) & constants.isSignedMask) == constants.isSignedMask;
  let signature = null;
  if (isSigned) {
    signature = getSignature(message);
    const hash = getHash(message);
    pubKey = ecRecoverPubKey(hash, signature);
  }

  // TODO:
  let padding = null

  return assignDefined({}, {payload, pubKey, signature, padding});
}

const getSignature = (plaintextBuffer) => "0x" + plaintextBuffer.slice(plaintextBuffer.length - constants.signatureLength, plaintextBuffer.length).toString('hex');

const getHash = (plaintextBuffer) => keccak256(hexToBytes(plaintextBuffer.slice(0, plaintextBuffer.length - constants.signatureLength).toString('hex')));

const ecRecoverPubKey = (messageHash, signature) => {
// From eth-lib
  const rsv = {
    r: slice(0, 32, signature).slice(2),
    s: slice(32, 64, signature).slice(2),
    v: toNumber(slice(64, length(signature), signature))
  }

  const ecPublicKey = secp256k1.recoverPubKey(new Buffer(messageHash.slice(2), "hex"), rsv, rsv.v < 2 ? rsv.v : 1 - rsv.v % 2);

  return ecPublicKey.encode('hex');
}


module.exports = {
  decryptSymmetric,
  decryptAsymmetric
};
