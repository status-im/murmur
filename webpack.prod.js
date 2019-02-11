const merge = require("webpack-merge");
const common = require("./webpack.common.js");

// TODO: use merge
common[0].mode = "production";
common[1].mode = "production";

module.exports = common;
