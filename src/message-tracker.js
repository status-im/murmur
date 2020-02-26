class MessageTracker {
  constructor() {
    this.messages = [];
  }

  exists(envelope, protocol) {
    const msgRecord = this.messages[envelope.id];

    return !!msgRecord;
    //if(!protocol || !msgRecord) return false;
    //return msgRecord[protocol] !== undefined;
  }

  push(envelope, protocol) {
    if (!this.messages[envelope.id]) this.messages[envelope.id] = {};
    this.messages[envelope.id][protocol] = envelope[1]; // TTL
    return envelope.id;
  }

  isSent(envelope) {
    return this.messages[envelope.id] && this.messages[envelope.id].sent;
  }

  sent(envelope) {
    this.messages[envelope.id].sent = true;
  }
}

export default MessageTracker;
