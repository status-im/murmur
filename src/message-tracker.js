const {keccak256} = require("eth-lib/lib/hash");

class MessageTracker {
  constructor(){
    this.messages = [];
  }

  id(message){
    // TODO: probably message id should be calculated once, when a message is received
    return keccak256(message.join(''));
  }

  exists(message, protocol){
    const msgRecord = this.messages[this.id(message)];

    return !!msgRecord;
    //if(!protocol || !msgRecord) return false;
    //return msgRecord[protocol] !== undefined;
  }

  push(message, protocol){
    const id = this.id(message);
    if(!this.messages[id]) this.messages[id] = {};
    this.messages[id][protocol] = message[1]; // TTL
    return id;
  }

  isSent(message){
    const id = this.id(message);
    return this.messages[id].sent;
  }

  sent(message){
    const id = this.id(message);
    this.messages[id].sent = true;
  }
}

module.exports = MessageTracker;
