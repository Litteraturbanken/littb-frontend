const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');


module.exports = merge(common, {
  

  // devtool: 'eval-source-map',
  // devtool: 'inline-source-map',
  mode: 'development',
  // plugins: [
  //   new webpack.HotModuleReplacementPlugin()
  // ]
});
