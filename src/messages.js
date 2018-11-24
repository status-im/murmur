const rlp = require('rlp-encoding')
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

const decryptAssymetric = (key, data, cb) => {
    throw new Error("not implemented yet");
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

    let start = 1;
    const end = decrypted.plaintext.byteLength;

    let payload;
    let pubKey;

    const auxiliaryFieldSize = decrypted.plaintext.readUIntLE(0, 1) & constants.flagMask;

    let auxiliaryField;
    if(auxiliaryFieldSize !== 0) {
      auxiliaryField = decrypted.plaintext.readUIntLE(start, auxiliaryFieldSize);
      start += auxiliaryFieldSize;
      payload = decrypted.plaintext.slice(start, start + auxiliaryField);
    }

    const isSigned = (decrypted.plaintext.readUIntLE(0, 1) & constants.isSignedMask) == constants.isSignedMask;
    let signature = null;
    if (isSigned) {
      signature = getSignature(decrypted.plaintext);
      const hash = getHash(decrypted.plaintext);
      pubKey = ecRecoverPubKey(hash, signature);
    }

    // TODO:
    let padding = null

    if(cb){
      return cb(null, assignDefined({}, {payload, pubKey, signature, padding}));
    }
  });
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
  hexToBytes
};
