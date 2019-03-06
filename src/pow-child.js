const pow = require('./pow');

process.on('message', async (data) => {
  let {powTarget, powTime, ttl, topic, encryptedMessage, expiry} = data;
  
  topic = Buffer.from(topic, 'hex');
  encryptedMessage = Buffer.from(encryptedMessage, 'hex');

  const powResult = pow.ProofOfWork(powTarget, powTime, ttl, topic, encryptedMessage, expiry);

  let nonceBuffer =  powResult.nonce;
  let non0 = false;
  let val = [];
  for(let i = 0; i < nonceBuffer.length; i++){
    if(nonceBuffer[i] !== 0){
      non0 = true;
    }
    if(non0){
      val.push(nonceBuffer[i]);
    }
  }

  nonceBuffer = Buffer.from(val);

  process.send({
    nonce: nonceBuffer.toString('hex'),
    expiry: powResult.expiry
  });

  
});
