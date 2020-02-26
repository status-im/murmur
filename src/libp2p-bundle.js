import WebRTCStar from "libp2p-webrtc-star";
import WebSockets from "libp2p-websockets";
// import WebSocketStar from 'libp2p-websocket-star');
import Bootstrap from "libp2p-bootstrap";
import Multiplex from "libp2p-mplex";
import SPDY from "libp2p-spdy";
import SECIO from "libp2p-secio";
import libp2p from "libp2p";
import WebSocketStarMulti from "libp2p-websocket-star-multi";

import data from "../data/config.json";

const BOOTNODES = data["libp2p"].bootnodes;
const SIGNALSERVERS = data["libp2p"].signalServers;

class LibP2PBundle extends libp2p {
  constructor(peerInfo, options) {
    let startWRTC = !!options.startWRTC;
    let signalServers = options.signalServers && options.signalServers.length ? options.signalServers : [];
    if (!signalServers.length) signalServers = SIGNALSERVERS && SIGNALSERVERS.length ? SIGNALSERVERS : [];

    let bootnodes = options.bootnodes && options.bootnodes.length ? options.bootnodes : [];
    if (!bootnodes.length) bootnodes = BOOTNODES && BOOTNODES.length ? BOOTNODES : [];

    let wrtcStar;
    if (startWRTC) {
      const wrtc = require("wrtc");
      wrtcStar = new WebRTCStar({id: peerInfo.id, wrtc: wrtc});
    } else {
      wrtcStar = new WebRTCStar({id: peerInfo.id});
    }

    signalServers.map(addr => {
      const ma = addr + "/ipfs/" + peerInfo.id.toB58String();
      peerInfo.multiaddrs.add(ma);
    });

    // This works with a single WRTC server
    //const wsstar = new WebSocketStar({ id: peerInfo.id });

    // This works with multiple WRTC servers
    const wsstar = new WebSocketStarMulti({
      servers: signalServers,
      id: peerInfo.id,
      ignore_no_online: true
    });

    super({
      modules: {
        transport: [wrtcStar, WebSockets, wsstar],
        streamMuxer: [Multiplex, SPDY],
        connEncryption: [SECIO],
        peerDiscovery: [wrtcStar.discovery, wsstar.discovery, Bootstrap]
      },
      peerInfo,
      config: {
        peerDiscovery: {
          webRTCStar: {
            enabled: true
          },
          websocketStar: {
            enabled: true
          },
          bootstrap: {
            interval: 10000,
            enabled: true,
            list: bootnodes
          }
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: false
          }
        },
        EXPERIMENTAL: {
          dht: false,
          pubsub: false
        }
      },
      connectionManager: {
        maxPeers: 15
      }
    });
  }
}

export default LibP2PBundle;
