const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');


module.exports = merge(common, {
  devServer: {
    host: process.env.LITTB_HOST || "localhost",
    port: process.env.LITTB_PORT || 9000,
    // hot : true,
    proxy: [{
        context : ["/api", "/red", "/txt", "/query", "/bilder", "/css", "/sla-bibliografi", "/authordb", "/xhr", "/ws", "/so"],
        target: 'http://demolittb.spraakdata.gu.se',
        changeOrigin : true
    }],
    historyApiFallback: true
  },

  // devtool: 'eval-source-map',
  // devtool: 'inline-source-map',
  mode: 'development',
  // plugins: [
  //   new webpack.HotModuleReplacementPlugin()
  // ]
});
