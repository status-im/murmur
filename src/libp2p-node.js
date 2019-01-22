const LibP2PBundle = require('./libp2p-bundle');
const PeerInfo = require('peer-info');
const chalk = require('chalk');
const pull = require('pull-stream');

let p2pNode;

const libP2Phandler = (err) => {
  if (err) { throw err; }
  console.log(chalk.yellow(`* libP2P started: ${p2pNode.isStarted()}, listening on:`));
  p2pNode.peerInfo.multiaddrs.forEach((ma) => console.log(chalk.yellow("- " + ma.toString())));
};

const createNode = (address) => {
  return new Promise(function(resolve, reject) {

    if(!address) address = '/ip4/0.0.0.0/tcp/0';
    PeerInfo.create((err, peerInfo) => {
      if(err) {
        reject(err);
      }

      peerInfo.multiaddrs.add(address);
      p2pNode = new LibP2PBundle(peerInfo);
      p2pNode.type = "libp2p";
      
      p2pNode.old_start = p2pNode.start;
      p2pNode.start = () => {
        p2pNode.old_start(libP2Phandler);
      };

      p2pNode.handle('/test', (protocol, conn) => {
        console.log("Received message")
        pull(conn,
          pull.map((v) => v.toString()),
          pull.log()
        );
      });
      
      resolve(p2pNode);
    });
  });
};
  
  
module.exports = {
  createNode
};
