const express = require('express');
const bodyParser = require('body-parser');
const chalk = require('chalk');
const program = require('commander');

program
  .version('0.1.0')
  .option('--ws', 'enable the websockets RPC server')
  .option('--wsport [port]', 'websockets RPC port [default: 8546]')
  .option('--devp2p-port [port]', "DEVP2P port [default: 30303]")
  .option('--libp2p-port [port]', "LIBP2P port [default: random port]")
  .option('--no-devp2p', 'disable DEVP2P')
  .option('--no-libp2p', 'disable LIBP2P')
  .option('--no-bridge', "disable bridge between LIBP2P and DEVP2P")
  .option('--ignore-bloom', "ignore Bloom Filters (forward everything")
  .option('--signal-servers [url]', "signal server address [i.e. /ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star,...]")
  .option('--config <path>', 'use configuration file. (default: provided config)')
  .parse(process.argv);

let app;
const ENABLE_WS = program.ws === true;
const WS_PORT =  program.wsport !== undefined ? parseInt(program.wsport, 10) : 8546;
const DEVP2P_PORT =  program.devp2pPort !== undefined ? parseInt(program.devp2pPort, 10) : 30303;
const LIBP2P_PORT =  program.libp2pPort !== undefined ? parseInt(program.libp2pPort, 10) : 0;
const IS_BRIDGE = program.libp2p && program.devp2p && program.bridge;
const SIGNAL_SERVER = program.signalServers !== undefined ? program.signalServers.split(",") : [];
const IGNORE_BLOOM = program.ignoreBloom === true || IS_BRIDGE;


let config;
if(program.config !== undefined){
  config = require(program.config);
} else {
  config = require("../data/config.json");
}


if(ENABLE_WS){
  app = express();
  require('express-ws')(app);
}

(async () => {

  const Provider = require('./provider');
  const provider = new Provider();
  const nodes = [];

  if(program.devp2p){
    const DevP2PNode = require('./devp2p-node.js');
    const devp2p = new DevP2PNode();
    devp2p.setConfig(config);
    devp2p.start();
    nodes.push(devp2p);
  }

  // TODO: validate signal servers format

  if(program.libp2p){
    const LibP2PNode = require('./libp2p-node.js');
    const libp2p =  new LibP2PNode({signalServers: SIGNAL_SERVER});
    libp2p.setConfig(config);
    libp2p.start();
    nodes.push(libp2p);
  }

  const Manager = require('./manager');
  const _manager = new Manager(provider, {
    isBridge: IS_BRIDGE,
    ignoreBloomFilters: IGNORE_BLOOM
  });
  _manager.setupNodes(nodes);
  _manager.start();

  if(IGNORE_BLOOM) console.log(chalk.yellow('* Bloom filters ignored'));

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
