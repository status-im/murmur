const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const chalk = require('chalk');

require('express-ws')(app);

(async () => {

  const Provider = require('./provider');
  const provider = new Provider();

  // DevP2P
  const devp2p = require('./client.js');
  devp2p.start();
  devp2p.connectTo({address: '127.0.0.1', udpPort: 30303, tcpPort: 30303});

  // LibP2P
  const LibP2PNode = require('./libp2p-node.js');
  const libp2p =  new LibP2PNode();
  libp2p.start();


  const Manager = require('./manager');
  const _manager = new Manager(provider, {libP2PClient: false, isBridge: true});
  _manager.setupNodes([devp2p, libp2p]);
  _manager.start();

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

  app.listen(8546, () => console.log(chalk.yellow('Murmur listening on port 8546!')));

})();
