const path = require('path');
const nodeExternals = require('webpack-node-externals');


const webConfig = {
  entry: path.join(__dirname, "src/index.js"),
  externals: {
    'ethereumjs-devp2p': 'ethereumjs-devp2p',
    'commander': 'commander',
    'express': 'express',
    'express-ws': 'express-ws'
  },
  target: 'web',
  output: {
    path: path.resolve(__dirname, "dist"),
    library: 'murmur',
    libraryTarget: 'commonjs2',
    filename: 'client.js'
  },
  module: {
    rules: [
      {
        test: /devp2p-node.js/,
        loader: 'null-loader'
      }
    ]
  }
};

const nodeConfig = {
  target: "node",
  entry: path.join(__dirname, "src/index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server.js",
    library: 'murmur',
    libraryTarget: 'commonjs2',
  },
  externals: [nodeExternals()]
};

module.exports = [webConfig, nodeConfig];
