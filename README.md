Murmur
===

<p align="center">
A Whisper node / client implementation built in Javascript, with the goal of being a pure JS project able to run in the browser.
</p>
<p align="center">
<strong>WIP. DO NOT USE IN PRODUCTION. HIGH RISK ⚠</strong>
</p>
<br />



## Installation
To install Murmur for use in node or the browser with require('murmur-client'), run:
```
npm install murmur-client
```

To install Murmur as a command line program, run:
```
npm install -g murmur-client
```
Alternatively, you can use `yarn`.


## Usage

Murmur can work as a command line application, and as a web3 provider in both browsers and node.js applications:

### Command line application

To start a bridge between LIBP2P and DEVP2P:
```
$ murmur
```

To start a non-bridge DEVP2P client, with websocket support for connecting to whisper using [web3.js](https://github.com/ethereum/web3.js/), with a `Web3.providers.WebsocketProvider` pointing `ws://localhost:8546`.
```
$ murmur --ws --no-libp2p --no-bridge
```

Full list of flags can be seen with `murmur -h`:
```
  -V, --version           output the version number
  --ws                    enable the websockets RPC server
  --config [path]         use configuration file. (default: provided config)
  --wsport [port]         websockets RPC port [default: 8546]
  --devp2p-port [port]    DEVP2P port [default: 30303]
  --libp2p-port [port]    LIBP2P port [default: 0]
  --no-devp2p             disable DEVP2P
  --no-libp2p             disable LIBP2P
  --no-bridge             disable bridge between LIBP2P and DEVP2P
  --signal-servers [url]  signal server address [i.e. /ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star,...]
  -h, --help              output usage information
```

In the case of `--config`, if this flag is not specified, it will use the default configuration included in the package: `data/config.js`. See this file for structure and valid values accepted.


### Web3 provider (in browsers and node.js applications)
Murmur can also be used as a JS library, since it can act as a valid web3 provider:

```js
const Murmur = require('murmur-client');
const Web3 = require('web3');

const server = new Murmur({
  protocols: ["libp2p"],
  signalServers: ["/dns4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star"],
  bootnodes: []
});

server.start();

server.onReady(async () => {
  const web3 = new Web3();
  web3.setProvider(server.provider);

  // Use web3.shh functions here
});

```

The `Murmur` object accepts an option array where protocols like `"libp2p"` and `"devp2p"` can be specified. It's recommended in the case of clients to only use a single protocol at a time. (It hasn't been tested yet with multiple protocols, since that functionality is intended for bridges). When using `"libp2p"`, the attribute `"signalServers"` is required, containing at least one signal server address. You can use the npm package [`js-libp2p-webrtc-star`](https://github.com/libp2p/js-libp2p-webrtc-star#rendezvous-server-aka-signalling-server) implementation if you do not have a signal server.

This package will be updated to allow specifying bootnodes and static nodes for `"devp2p"`. Currently it will use those specified in the configuration included in the package: `data/config.js`

## Contribution

Thank you for considering to help out with the source code! We welcome contributions from anyone on the internet, and are grateful for even the smallest of fixes!

If you'd like to contribute to `murmur`, please fork, fix, commit and send a pull request for the maintainers to review and merge into the main code base. If you wish to submit more complex changes though, please check up with the core devs first on [#status-js channel](https://get.status.im/chat/public/status-js) to ensure those changes are in line with the general philosophy of the project and/or get some early feedback which can make both your efforts much lighter as well as our review and merge procedures quick and simple.
