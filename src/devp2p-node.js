import devp2p from "ethereumjs-devp2p";
import {randomBytes} from "crypto-browserify";
import ms from "ms";
import chalk from "chalk";
import assert from "assert";
import rlp from "rlp-encoding";
import Events from "events";
import ip from "ip";
import os from "os";
import {SHH_BLOOM, SHH_MESSAGE, SHH_STATUS} from "./constants";
import Envelope from "./envelope";
import SHH from "./shh.js";
import pjson from "../package.json";

const devP2PHello = (id, port) => {
  console.log(chalk.yellow("* devP2P started: true, listening on:"));
  console.log(chalk.yellow("- " + id.toString("hex") + "@" + ip.address() + ":" + port));
};

const parseENR = enode => {
  const p = enode.split("@");
  const q = p[1].split(":");
  const id = Buffer.from(p[0].replace("enode://", ""), "hex");
  const address = q[0];
  const port = q[1];
  return {id, address, port};
};

const getPeerAddr = peer => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`;

class DevP2PNode {
  constructor(options) {
    if (!options) options = {};

    this.privateKey = options.privateKey || randomBytes(32);
    this.bootnodes = options.bootnodes || [];
    this.staticnodes = options.staticNodes ? options.staticNodes.map(parseENR) : [];
    this.trustedPeers = options.trustedPeers || [];
    this.events = new Events();
    this.peers = {};

    // Candidate for DI
    this.tracker = null;
    this.bloomManager = null;

    this.type = "devp2p";
  }

  setConfig(config) {
    this.privateKey = config.devp2p.account ? Buffer.from(config.devp2p.account, "hex") : randomBytes(32);
    this.staticnodes = config.devp2p.staticNodes.map(parseENR);
    this.trustedPeers = config.devp2p.trustedPeers;
    this.bootnodes = config.devp2p.bootnodes.map(parseENR).map(node => {
      return {
        address: node.address,
        udpPort: node.port,
        tcpPort: node.port
      };
    });
  }

  setTracker(tracker) {
    this.tracker = tracker;
  }

  setBloomManager(bloomManager) {
    this.bloomManager = bloomManager;
    this.bloomManager.on("updated", () => {
      this.broadcast(this.bloomManager.getBloomFilter(), null, SHH_BLOOM);
    });
  }

  start(ip, port) {
    this.ip = "0.0.0.0";
    this.port = "30303";

    this._startDPT();
    this._startRLPX();
    if (ip) {
      this.rlpx.listen(port, ip);
      this.dpt.bind(port, ip);
    }

    this.addBootnodes(this.bootnodes);
  }

  broadcast(input, peerId, code = SHH_MESSAGE) {
    const message = rlp.encode(input instanceof Envelope ? [input.message] : input);

    if (code === null) code = SHH_MESSAGE;

    if (peerId) {
      let peer = this.peers[peerId];
      peer.shh.sendMessage(code, message);
    } else {
      for (let peerId of Object.keys(this.peers)) {
        let peer = this.peers[peerId];
        if (code == SHH_MESSAGE && !this.bloomManager.filtersMatch(peer.bloom, input.bloom)) continue;
        peer.shh.sendMessage(code, message);
      }
    }
  }

  _startDPT() {
    this.dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: 30000,
      timeout: 20000,
      endpoint: {address: "0.0.0.0", udpPort: null, tcpPort: null}
    });
    this.dpt.on("error", err => console.error(chalk.red(`DPT error: ${err}`)));
  }

  addTrustedPeer(node) {
    this.trustedPeers.push(node);
  }

  addStaticPeer(node, cb) {
    this.staticnodes.push(node);
    this.rlpx
      .connect({id: node.id, address: node.address, port: node.port})
      .then(_res => {
        cb(null, true);
      })
      .catch(err => {
        if (err.message.indexOf("Already connected") > -1) {
          cb(null, true);
        } else {
          cb(err);
        }
      });
  }

  isTooOld(expiry) {
    const dt = new Date().getTime() / 1000;
    return expiry.readUInt32BE(0) < dt;
  }

  _startRLPX() {
    this.rlpx = new devp2p.RLPx(this.privateKey, {
      dpt: this.dpt,
      maxPeers: 50,
      clientId: Buffer.from(`murmur/v${pjson.version}/${os.platform()}-${os.arch()}/nodejs`),
      capabilities: [
        {name: "shh", version: 6, length: 300, constructor: SHH}
      ],
      listenPort: null
    });

    this.staticnodes.map(node => {
      this.rlpx.connect({id: node.id, address: node.address, port: node.port});
    });

    devP2PHello(this.rlpx._id, this.port);

    this.rlpx.on("error", err => console.error(chalk.red(`RLPx error: ${err.stack || err}`)));

    this.rlpx.on("listening", () => {
      this.events.emit("ready");
    });

    this.rlpx.on("peer:added", peer => {
      const shh = peer.getProtocols()[0];

      let peerId = peer._hello.id.toString("hex");

      this.peers[peerId] = {peer, shh};

      shh.events.on("bloom_exchange", bloom => {
        this.peers[peerId].bloom = bloom;
      });

      shh.events.on("status", status => {
        // TODO: don't hardcode minpow
        const payload = [
          status[0], // version
          Buffer.from("3f50624dd2f1a9fc", "hex"), // minPow
          this.bloomManager.getBloomFilter(),
          Buffer.from([]), // isLightnode
          Buffer.from([1]) // confirmations
        ];
        this.peers[peerId].bloom = status[2];
        this.broadcast(payload, null, SHH_STATUS);
      });

      shh.events.on("message", (envelope, peer) => {
        if (this.tracker.exists(envelope, "devp2p")) return;

        // Verify if message matches bloom filter
        if (!this.bloomManager.match(envelope.bloom)) return;

        // Verifying if old message is sent by trusted peer
        const trustedPeer = this.trustedPeers.includes(peer);
        const tooOld = this.isTooOld(envelope.expiry);

        if (tooOld && !trustedPeer) return;

        if (!tooOld) {
          // Broadcast received message again.
          this.tracker.push(envelope, "devp2p");
          this.broadcast(envelope);

          this.events.emit("shh_message", envelope);
        } else {
          this.events.emit("shh_old_message", envelope, peer);
        }
      });

      const clientId = peer.getHelloMessage().clientId;
      console.log(chalk.green(`Add devp2p peer: ${getPeerAddr(peer)} ${clientId}`));
    });

    this.rlpx.on("peer:removed", (peer, reasonCode, disconnectWe) => {
      const staticNode = this.staticnodes.find(x => x.id.equals(peer._remoteId));
      if (staticNode) {
        // TODO: if a static node dies, attempt to reconnect.
        this.rlpx.connect({id: staticNode.id, address: staticNode.address, port: staticNode.port});
      }

      const who = disconnectWe ? "we disconnect" : "peer disconnect";
      const total = this.rlpx.getPeers().length;
      console.log(
        chalk.yellow(
          `Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(reasonCode)} (${String(
            reasonCode
          )}) (total: ${total})`
        )
      );
    });

    this.rlpx.on("peer:error", (peer, err) => {
      if (err.code === "ECONNRESET") {
        return;
      }

      if (err instanceof assert.AssertionError) {
        const peerId = peer.getId();
        if (peerId !== null) this.dpt.banPeer(peerId, ms("5m"));

        console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.message}`));
        return;
      }

      console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.stack || err}`));
    });
  }

  addBootnodes(bootnodes) {
    bootnodes.forEach(bootnode => {
      this.dpt.bootstrap(bootnode).catch(err => {
        console.error(chalk.bold.red(`DPT bootstrap error: ${err.message}`));
      });
    });
  }

  connectTo(node) {
    this.dpt
      .addPeer(node)
      .then(peer => {
        console.dir("==> peer added");
        return this.rlpx.connect({
          id: peer.id,
          address: peer.address,
          port: peer.tcpPort
        });
      })
      .catch(err => console.log(chalk.bold.red(`error on connection to local node: ${err.message}`)));
  }
}

export default DevP2PNode;
