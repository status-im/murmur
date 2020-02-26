const common = require("./webpack.common.js");
common.mode = "production";
common.optimization = {
  usedExports: true,
  sideEffects: true
};

module.exports = common; 
