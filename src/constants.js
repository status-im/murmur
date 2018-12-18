module.exports = {
    aesNonceLength: 12,
    dummyAuthTag: Buffer.from("11223344556677889900112233445566", 'hex'),
    flagMask: 3, // 0011
    isSignedMask: 4, // 0100
    signatureLength: 65, // bytes,
    symKeyLength: 32, // bytes,
    keyIdLength: 32,
    privKeyLength: 32,

    message: 1,
    p2pMessage: 127
}
