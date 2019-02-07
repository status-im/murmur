const SHH_STATUS = 0;
const SHH_MESSAGE = 1;
const SHH_BLOOM = 3;
const SHH_P2PMSG = 127;


module.exports = {
    aesNonceLength: 12,
    dummyAuthTag: Buffer.from("11223344556677889900112233445566", 'hex'),
    flagMask: 3, // 0011
    isSignedMask: 4, // 0100
    signatureLength: 65, // bytes,
    symKeyLength: 32, // bytes,
    keyIdLength: 32,
    privKeyLength: 32,
    
    
    SHH_STATUS,
    SHH_BLOOM,
    SHH_MESSAGE,
    SHH_P2PMSG
  
};
