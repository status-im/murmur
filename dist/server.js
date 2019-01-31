"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

var _stringify = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/json/stringify"));

var _parseInt2 = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/parse-int"));

const express = require('express');

const bodyParser = require('body-parser');

const chalk = require('chalk');

const program = require('commander');

program.version('0.1.0').option('--ws', 'Enable the WS-RPC server').option('--wsport [port]', 'WS-RPC Port (default: 8546)').option('--devp2p-port [port]', "DEVP2P Port (default: 30303").option('--libp2p-port [port]', "LIBP2P Port (default: 0").option('--no-devp2p', 'Disable DEVP2P').option('--no-libp2p', 'Disable LIBP2P').option('--no-bridge', "Disable bridge between LIBP2P and DEVP2P").option('--signal-servers [url]', "Signal server url (ws://127.0.0.1:9090,...").parse(process.argv);
let app;
const ENABLE_WS = program.ws === true;
const WS_PORT = program.wsport !== undefined ? (0, _parseInt2.default)(program.wsport, 10) : 8546;
const DEVP2P_PORT = program.devp2pPort !== undefined ? (0, _parseInt2.default)(program.devp2pPort, 10) : 30303;
const LIBP2P_PORT = program.libp2pPort !== undefined ? (0, _parseInt2.default)(program.libp2pPort, 10) : 0;
const IS_BRIDGE = program.libp2p && program.devp2p && program.bridge;
const SIGNAL_SERVER = program.signalServers !== undefined ? program.signalServers.split(",") : [];

if (ENABLE_WS) {
  app = express();

  require('express-ws')(app);
}

(async () => {
  const Provider = require('./provider');

  const provider = new Provider();
  const nodes = [];

  if (program.devp2p) {
    const devp2p = require('./client.js');

    devp2p.start();
    nodes.push(devp2p);
  } // TODO: validate signal servers format


  if (program.libp2p) {
    const LibP2PNode = require('./libp2p-node.js');

    const libp2p = new LibP2PNode({
      signalServers: SIGNAL_SERVER
    });
    libp2p.start();
    nodes.push(libp2p);
  }

  const Manager = require('./manager');

  const _manager = new Manager(provider, {
    isBridge: IS_BRIDGE
  });

  _manager.setupNodes(nodes);

  _manager.start();

  if (!ENABLE_WS) return;
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(bodyParser.json());
  app.ws('/', function (ws, _req) {
    ws.on('message', function (msg) {
      provider.sendAsync(JSON.parse(msg), (err, jsonResponse) => {
        if (err) {
          console.dir(err);
          ws.send({
            error: err
          });
        }

        ws.send((0, _stringify.default)(jsonResponse));
      });
    });
    provider.on('data', result => {
      // TODO: actually should only do this for subscribers.....
      //console.dir("======================");
      //console.dir("sending....");
      //console.log(JSON.stringify(result));
      //console.dir(result);
      ws.send((0, _stringify.default)(result)); //console.dir("======================");
    });
  });
  app.listen(WS_PORT, () => console.log(chalk.yellow(`Murmur listening on port ${WS_PORT}`)));
})();
//# sourceMappingURL=server.js.map