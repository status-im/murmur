const stripHexPrefix = require('strip-hex-prefix');

const BloomFilterSize = 64;

const createBloomFilter = (message) => {
    if(message.topics && message.topics.length > 0){
        return topicsToBloom(message.topics);
    }
    return topicsToBloom(message.topic);
}
  

const topicToBloom = topic => {

    if(!Buffer.isBuffer(topic)){
        topic = Buffer.from(stripHexPrefix(topic), 'hex');
    }

    const b = Buffer.alloc(BloomFilterSize, 0);
    const index = Array(3);

    for(let j = 0; j < 3; j++){
        index[j] = parseInt(topic[j], 10);
        if((topic[3] & (1 << j)) != 0) {
            index[j] += 256
        }
    }

    for(let j = 0; j < 3; j++){
        const byteIndex = parseInt(index[j] / 8, 10);
        const bitIndex = parseInt(index[j] % 8, 10);
        b[byteIndex] = (1 << bitIndex)
    }
    return b;
}
  
const topicsToBloom = (topics) => {
    let data = Buffer.alloc(BloomFilterSize, 0)
    for(let idx = 0; idx < topics.length; idx++){
      const bloom = topicToBloom(topics[idx]);
      for(let i = 0; i < BloomFilterSize; i++){
        data[i] = data[i] | bloom[i];
      }
    }
    
    let combined = Buffer.alloc(BloomFilterSize, 0);
    combined = Buffer.concat([data, combined.slice(BloomFilterSize - data.length)]);
    return combined;
}
  

module.exports = {
    createBloomFilter,
    topicToBloom,
    topicsToBloom
};