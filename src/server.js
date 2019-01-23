const express = require('express');
const bodyParser = require('body-parser');
const chalk = require('chalk');
const program = require('commander');

program
  .version('0.1.0')
  .option('--ws', 'Enable the WS-RPC server')
  .option('--wsport [port]', 'WS-RPC Port (default: 8546)')
  .option('--no-devp2p', 'Disable DEVP2P')
  .option('--no-libp2p', 'Disable LIBP2P')
  .parse(process.argv);

let app;
const ENABLE_WS = program.ws === true;
const WS_PORT =  program.wsport !== undefined ? parseInt(program.wsport, 10) : 8546;

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
    devp2p.connectTo({address: '127.0.0.1', udpPort: 30303, tcpPort: 30303});
    nodes.push(devp2p);
  }

  if(program.libp2p){
    const LibP2PNode = require('./libp2p-node.js');
    const libp2p =  new LibP2PNode();
    libp2p.start();
    nodes.push(libp2p);
  }


  const Manager = require('./manager');
  const _manager = new Manager(provider, {libP2PClient: false, isBridge: true});
  _manager.setupNodes(nodes);
  _manager.start();

  if(!ENABLE_WS) return;
  
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());

  app.ws('/', function(ws, _req) {
    ws.on('message', function(msg) {
      console.dir(msg);
      provider.sendAsync(JSON.parse(msg), (err, jsonResponse) => {
        if (err) {
          console.dir(err);
          ws.send({error: err});
        }
        console.dir(jsonResponse);
        ws.send(JSON.stringify(jsonResponse));
      });
    });
    provider.on('data', (result) => {
      // TODO: actually should only do this for subscribers.....
      console.dir("======================");
      console.dir("======================");
      console.dir("======================");
      console.dir("sending....");
      console.log(JSON.stringify(result));
      console.dir(result);
      ws.send(JSON.stringify(result));
      console.dir("======================");
      console.dir("======================");
      console.dir("======================");
    });
  });

  app.listen(WS_PORT, () => console.log(chalk.yellow(`Murmur listening on port ${WS_PORT}`)));

})();
