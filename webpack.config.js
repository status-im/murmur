var webpack = require('webpack');

var plugins = [];
plugins.push(
    new webpack.IgnorePlugin(/(ethereumjs-devp2p|libp2p-bundle-node)/)
);


module.exports = {
  entry: './src/index.js',
  mode: 'development',
  target: 'web',
  output: {
    library: 'Murmur',
    libraryTarget: 'var',
    filename: 'murmur.js'
  },
  plugins: plugins
};
