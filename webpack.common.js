var webpack = require('webpack');
const path = require("path");

var plugins = [];
plugins.push(
    new webpack.IgnorePlugin(/(ethereumjs-devp2p|devp2p-node)/)
);


module.exports = {
  entry: path.join(__dirname, "src/index.js"),
  externals: {
    'ethereumjs-devp2p': 'ethereumjs-devp2p',
    'commander': 'commander',
    'express': 'express',
    'express-ws': 'express-ws'
  },
  target: 'web',
  output: {
    library: 'Murmur',
    libraryTarget: 'var',
    filename: 'murmur.js'
  },
  plugins: plugins
};
