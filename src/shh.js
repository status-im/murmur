import rlp from "rlp-encoding";
import Events from "events";
import Envelope from "./envelope";
import {SHH_BLOOM, SHH_MESSAGE, SHH_P2PMSG, SHH_STATUS} from "./constants";

class SHH {
  constructor(version, peer, send) {
    this.version = version;
    this.peer = peer;
    this.send = send;
    this.events = new Events();
  }

  _handleMessage(code, data) {
    const payload = rlp.decode(data);

    if (code === SHH_STATUS) this.events.emit("status", payload);

    // Bloom filter
    if (code === SHH_BLOOM) this.events.emit("bloom_exchange", payload);

    if (code === SHH_MESSAGE || code === SHH_P2PMSG) {
      payload.forEach(envelope => {
        // TODO: replace with envelope or decrypted fields, whatever abstraction makes more sense
        const peer = `enode://${this.peer._remoteId.toString("hex")}@${this.peer._socket._peername.address}:${this.peer._socket._peername.port}`;
        this.events.emit("message", new Envelope(envelope), peer);
      });
    }
  }

  sendMessage(code, payload) {
    this.send(code, payload);
  }
}

export default SHH;
