const crypto = require('crypto');
const gcm = require('node-aes-gcm');
const elliptic = require("elliptic");
const {keccak256} = require("eth-lib/lib/hash");
const {slice, length, toNumber} = require("eth-lib/lib/bytes");
const constants = require('./constants');
const { randomBytes } = require('crypto')
const stripHexPrefix = require('strip-hex-prefix');
const secp256k1 = new elliptic.ec("secp256k1");
const secp256k1_ = require('secp256k1')
// TODO: use only 'secp256k1_'.  the other has a bug signing messages


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


/**
 * Object.assign but only for defined values
 * @param {object} target 
 * @param  {...object} sources 
 */
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


const addPayloadSizeField = (msg, payload) => {
  let fieldSize = getSizeOfPayloadSizeField(payload);
  let field = Buffer.alloc(4);
  field.writeUInt32LE(payload.length, 0);
  field = field.slice(0, fieldSize);
  msg = Buffer.concat([msg, field]);
  msg[0] |= fieldSize;
  return msg;
}


const getSizeOfPayloadSizeField = (payload) => {
	let s = 1;
	for(i = payload.length; i>= 256; i /= 256) {
		s++
	}
	return s;
}


const kdf = (hashName, z, s1, kdLen, cb) => {
  const BlockSize = 64; // TODO: extract to constant
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
    hash.update(z);  
    hash.update(s1);
    k = Buffer.concat([k, hash.digest()]);
    counter[3]++;
  }
  
  return k.slice(0, 32);
}

const aes128dec = (ct, key) => {
  const blSize = 16;
  const iv = ct.slice(0, blSize);
  const ciphertext = ct.slice(blSize);

  var cipher = crypto.createDecipheriv("aes-128-ctr", key, iv);
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

  const decrypted = aes128dec(ct, ke);

  const msgObj = parseMessage(decrypted);

  cb(null, msgObj);
}

const encryptSymmetric = (topic, envelope, options, cb) => {
  const symKey = Buffer.from(stripHexPrefix(options.symKey.symmetricKey), 'hex');

  if(!validateDataIntegrity(symKey, constants.symKeyLength)){
    const errMsg = "invalid key provided for symmetric encryption, size: " + symKey.length;
    if(cb) return cb(errMsg);
    throw errMsg;
  }
  
  const salt = randomBytes(constants.aesNonceLength) ;

  const encrypted = gcm.encrypt(symKey, salt, envelope, Buffer.from([]))
  envelope = Buffer.concat([encrypted.ciphertext, encrypted.auth_tag, salt]);

  cb(null, envelope);
}

const decryptSymmetric = (topic, key, data, cb) => {
  if (data.length < constants.aesNonceLength) {
    const errorMsg = "missing salt or invalid payload in symmetric message";
    if(cb) return cb(errorMsg);
    throw errorMsg;
  }

  const salt = data.slice(data.length - constants.aesNonceLength);
  const msg = data.slice(0, data.length - 12 );
  const decrypted = gcm.decrypt(key, salt, msg.slice(0, msg.length - 16), Buffer.from([]), msg.slice(msg.length - 16));
  const msgObj = parseMessage(decrypted.plaintext);

  cb(null, msgObj);
}

const parseMessage = (message) => {
  let start = 1;
  const end = message.length;

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
    const hash = getHash(message, isSigned);
    pubKey = ecRecoverPubKey(hash, signature);
  }

  // TODO:
  let padding = null

  return assignDefined({}, {payload, pubKey, signature, padding});
}

const getSignature = (plaintextBuffer) => {
  return "0x" + plaintextBuffer.slice(plaintextBuffer.length - constants.signatureLength, plaintextBuffer.length).toString('hex');
}

const getHash = (plaintextBuffer, isSigned) => {
  if(isSigned){
    return keccak256(hexToBytes(plaintextBuffer.slice(0, plaintextBuffer.length - constants.signatureLength).toString('hex')));
  } else {
    return keccak256(hexToBytes(plaintextBuffer.toString('hex')));

  }
}

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

const validateDataIntegrity = (k, expectedSize) => {
	if(k.length !== expectedSize) {
		return false;
  }
  
	if(expectedSize > 3 && k.equals(Buffer.alloc(k.length))){
		return false;
  }
  
	return true;
}

const buildMessage = (messagePayload, padding, sig, options, cb) => {
  // TODO: extract to constants
  const flagsLength = 1; 
  const payloadSizeFieldMaxSize = 4;
  const signatureLength = 65; 
  const padSizeLimit = 256;

  let envelope = Buffer.from([0]); // No flags
  envelope = addPayloadSizeField(envelope, messagePayload);
  envelope = Buffer.concat([envelope, messagePayload]);

  if(!!padding){
    envelope = Buffer.concat([envelope, padding]);
  } else {
    // Calculate padding:
    let rawSize = flagsLength + getSizeOfPayloadSizeField(messagePayload) + messagePayload.length;

    if(options.from){
      rawSize += constants.signatureLength;
    }

    const odd = rawSize % padSizeLimit;
    const paddingSize = padSizeLimit - odd;
    const pad = randomBytes(paddingSize);

    if(!validateDataIntegrity(pad, paddingSize)) {
      return cb("failed to generate random padding of size " + paddingSize);
    }

    envelope = Buffer.concat([envelope, pad]);
  }

  if(sig != null){
    // Sign the message
    if(envelope.readUIntLE(0, 1) & constants.isSignedMask){ // Is Signed
      cb("failed to sign the message: already signed");
    }

    envelope[0] |= constants.isSignedMask; 
    const hash = keccak256("0x" + envelope.toString('hex'));
    const s = secp256k1_.sign(Buffer.from(hash.slice(2), 'hex'), Buffer.from(options.from.privKey.slice(2), 'hex'));   
    envelope = Buffer.concat([envelope, s.signature, Buffer.from([s.recovery])]);
  }

  return envelope;
}


module.exports = {
  decryptSymmetric,
  decryptAsymmetric,
  encryptSymmetric,
  hexToBytes,
  buildMessage,
  parseMessage
};
