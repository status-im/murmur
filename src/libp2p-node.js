const LibP2PBundle = require('./libp2p-bundle');
const PeerInfo = require('peer-info');
const chalk = require('chalk');

let p2pNode;

const libP2Phandler = (err) => {
  if (err) { throw err; }
  console.log(chalk.yellow(`* libP2P bridge started: ${p2pNode.isStarted()}, listening on:`));
  p2pNode.peerInfo.multiaddrs.forEach((ma) => console.log(chalk.yellow(ma.toString())));
};

const start = () => {
  PeerInfo.create((err, peerInfo) => {
    if(err) throw err;
    peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0');
    p2pNode = new LibP2PBundle(peerInfo);
    setTimeout(() => {
      p2pNode.start(libP2Phandler);
    }, 2000);
  });
};

module.exports = {
  start,
  type: "libp2p"
};
