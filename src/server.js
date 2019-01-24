const express = require('express');
const bodyParser = require('body-parser');
const chalk = require('chalk');
const program = require('commander');

program
  .version('0.1.0')
  .option('--ws', 'Enable the WS-RPC server')
  .option('--wsport [port]', 'WS-RPC Port (default: 8546)')
  .option('--devp2p-tcp-port', "DEVP2P TCP Listener Port (default: 30303")
  .option('--devp2p-udp-port', "DEVP2P UDP Discovery Port (default: 30303")
  .option('--no-devp2p', 'Disable DEVP2P')
  .option('--no-libp2p', 'Disable LIBP2P')
  .option('--no-bridge', "Disable bridge between LIBP2P and DEVP2P")
  .parse(process.argv);

let app;
const ENABLE_WS = program.ws === true;
const WS_PORT =  program.wsport !== undefined ? parseInt(program.wsport, 10) : 8546;
const TCP_PORT =  program.devp2pTcpPort !== undefined ? parseInt(program.devp2pTcpPort, 10) : 30303;
const UDP_PORT =  program.devp2pUdpPort !== undefined ? parseInt(program.devp2pUdpPort, 10) : 30303;
const IS_BRIDGE = program.libp2p && program.devp2p && program.bridge;

if(ENABLE_WS){
  app = express();
  require('express-ws')(app);
}

(async () => {

  const Provider = require('./provider');
  const provider = new Provider();
  const nodes = [];

  if(program.devp2p){
    const devp2p = require('./client.js');
    devp2p.start();
    devp2p.connectTo({address: '127.0.0.1', udpPort: UDP_PORT, tcpPort: TCP_PORT});
    nodes.push(devp2p);
  }

  if(program.libp2p){
    const LibP2PNode = require('./libp2p-node.js');
    const libp2p =  new LibP2PNode();
    libp2p.start();
    nodes.push(libp2p);
  }


  const Manager = require('./manager');
  const _manager = new Manager(provider, {isBridge: IS_BRIDGE});
  _manager.setupNodes(nodes);
  _manager.start();

  if(!ENABLE_WS) return;
  
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());

  app.ws('/', function(ws, _req) {
    ws.on('message', function(msg) {
      provider.sendAsync(JSON.parse(msg), (err, jsonResponse) => {
        if (err) {
          console.dir(err);
          ws.send({error: err});
        }
        ws.send(JSON.stringify(jsonResponse));
      });
    });
    provider.on('data', (result) => {
      
      // TODO: actually should only do this for subscribers.....
      //console.dir("======================");
      //console.dir("sending....");
      //console.log(JSON.stringify(result));
      //console.dir(result);
      ws.send(JSON.stringify(result));
      //console.dir("======================");
    });
  });

  app.listen(WS_PORT, () => console.log(chalk.yellow(`Murmur listening on port ${WS_PORT}`)));

})();
