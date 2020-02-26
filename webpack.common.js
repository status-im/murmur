const path = require("path");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const webConfig = {
  entry: path.join(__dirname, "src/index.js"),
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|devp2p-node.js)/,
        use: [
          {
            loader: "babel-loader"
          }
        ]
      },
      {
        test: /devp2p-node.js/,
        loader: "null-loader"
      }
    ]
  },
  externals: {
    "ethereumjs-devp2p": "ethereumjs-devp2p",
    commander: "commander",
    express: "express",
    "express-ws": "express-ws"
  },
  target: "web",
  output: {
    path: path.resolve(__dirname, "minified"),
    library: "murmur",
    libraryTarget: "umd",
    filename: "murmur.js"
  },
  plugins: [
    new BundleAnalyzerPlugin()
  ]
};

module.exports = webConfig;
