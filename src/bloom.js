const stripHexPrefix = require('strip-hex-prefix');
const Events = require('events');

const BloomFilterSize = 64;
const syncAllowance = 10000; // 10seconds

class BloomFilterManager {
  constructor(ignoreBloomFilters){
    this.bloomFilter = Buffer.alloc(BloomFilterSize);
    this.prevFilters = [];
    this.ignoreBloomFilters = ignoreBloomFilters;
    this.events = new Events();

    this.events.on('updateFilter', topics => { 
      this.updateBloomFilter(topics); 
    });
  }

  emit(eventName, args){
    this.events.emit(eventName, args);
  }

  on(eventName, cb){
    this.events.on(eventName, cb);
  }

  match(filter){
    if(this.ignoreBloomFilters) return true;

    if(bloomFilterMatch(this.getBloomFilter(), filter)) return true;

    const prevFilters = this.prevFilters.slice();
    for(let i = 0; i < prevFilters.length; i++){
      if(bloomFilterMatch(prevFilters[i], filter)) return true;
    }
    return false;
  }

  filtersMatch(base, searchValue){
    if(this.ignoreBloomFilters) return true;

    return bloomFilterMatch(base, searchValue);
  }
  
  updateBloomFilter(topics) {
    if(this.ignoreBloomFilters) return true;

    const topicsBloomFilter = topicsToBloom(topics); 
    if(!this.match(topicsBloomFilter) || this.getBloomFilter().equals(Buffer.from([]))) {
      this.setBloomFilter(bloomFilterAddition(this.bloomFilter, topicsBloomFilter));
    }
  }

  setBloomFilter(newFilter){
    if(this.ignoreBloomFilters) return true;

    if(newFilter.length != BloomFilterSize) throw new Error("Invalid bloom size");
    const oldFilter = this.bloomFilter;
    this.bloomFilter = newFilter;
    this.prevFilters.push(oldFilter);
    this.events.emit('updated');
   
    setTimeout(() => { // Delete old bloom filters
      this.prevFilters = this.prevFilters.filter(x => !x.equals(oldFilter));
    }, syncAllowance);
  }

  getBloomFilter() {
    const b = Buffer.alloc(BloomFilterSize);
    this.bloomFilter.copy(b);
    if(b.equals(Buffer.alloc(BloomFilterSize))) return Buffer.from([]);
    return b; 
  }
}

const bloomFilterMatch = (base, searchValue) => {
  if(!base || !searchValue) return true;
  if(base.equals(Buffer.from([])) || searchValue.equals(Buffer.from([]))) return true;
  if(base.length != BloomFilterSize || searchValue.length != BloomFilterSize) throw new Error("Invalid bloom filter size");
  for(let i = 0; i < BloomFilterSize; i++){
    const a = base[i];
    const b = searchValue[i];
    if((a | b) != a) return false;
  }
  return true;
};

const bloomFilterAddition = (filter1, filter2) => {
  if(filter1.equals(Buffer.from([]))) return filter2;

  const r = Buffer.alloc(BloomFilterSize);
  for(let i = 0; i < BloomFilterSize; i++){
    r[i] = filter1[i] | filter2[i];
  }
  return r;
};

const createBloomFilter = (message) => {
  if (message.topics && message.topics.length > 0){
    return topicsToBloom(message.topics);
  }
  return topicsToBloom(message.topic);
};

const topicToBloom = topic => {
  if (!Buffer.isBuffer(topic)){
    topic = Buffer.from(stripHexPrefix(topic), 'hex');
  }

  const b = Buffer.alloc(BloomFilterSize, 0);
  const index = Array(3);

  for (let j = 0; j < 3; j++) {
    index[j] = parseInt(topic[j], 10);
    if ((topic[3] & (1 << j)) != 0) {
      index[j] += 256;
    }
  }

  for(let j = 0; j < 3; j++){
    const byteIndex = parseInt(index[j] / 8, 10);
    const bitIndex = parseInt(index[j] % 8, 10);
    b[byteIndex] = (1 << bitIndex);
  }
  return b;
};

const topicsToBloom = (topics) => {
  let data = Buffer.alloc(BloomFilterSize, 0);
  for (let idx = 0; idx < topics.length; idx++) {
    const bloom = topicToBloom(topics[idx]);
    for (let i = 0; i < BloomFilterSize; i++) {
    data[i] = data[i] | bloom[i];
    }
  }

  return data;
};

module.exports = {
  default: BloomFilterManager,
  createBloomFilter,
  bloomFilterAddition,
  topicToBloom,
  topicsToBloom,
  bloomFilterMatch
};
