const common = require('./webpack.common.js');
const merge = require('webpack-merge');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ngAnnotatePlugin = require('ng-annotate-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const CompressionPlugin = require("compression-webpack-plugin")





module.exports = merge(common, {
  plugins: [
    new CleanWebpackPlugin(['dist']),
    new ngAnnotatePlugin({
      add: true
    }),
    new CompressionPlugin({
      // test: ""
    })
  ],
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        cache: true,
        parallel: true,
        sourceMap: false,
        uglifyOptions: {
          mangle: {
            reserved: ["$super"]
          }
        }
      })
    ]
  },
  mode: 'production'
});

