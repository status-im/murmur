export const SHH_STATUS = 0;
export const SHH_MESSAGE = 1;
export const SHH_BLOOM = 3;
export const SHH_P2PREQ = 126;
export const SHH_P2PMSG = 127;


export const aesNonceLength = 12;
export const dummyAuthTag = Buffer.from("11223344556677889900112233445566", "hex");
export const flagMask = 3; // 0011
export const isSignedMask = 4; // 0100
export const signatureLength = 65; // bytes,
export const symKeyLength = 32; // bytes,
export const keyIdLength = 32;
export const privKeyLength = 32;
