const path = require("path");


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
  module: {
    rules: [
      {
        test: /devp2p-node.js/,
        loader: 'null-loader'
      }
    ]
  }
};
