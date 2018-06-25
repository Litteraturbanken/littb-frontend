const common = require('./webpack.common.js');
const merge = require('webpack-merge');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ngAnnotatePlugin = require('ng-annotate-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const CompressionPlugin = require("compression-webpack-plugin")

const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");



module.exports = merge(common, {
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[contenthash].[name].css",
      chunkFilename: "[id].css"
    }),
    new CleanWebpackPlugin(['dist']),
    new ngAnnotatePlugin({
      add: true
    }),
    new CompressionPlugin({})
  ],
  module: {
    rules: [
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
            MiniCssExtractPlugin.loader,
            "css-loader", // translates CSS into CommonJS
            {
              loader: "postcss-loader",
              options: {
                plugins: () => [require('autoprefixer')]
              }
            },
            "sass-loader" // compiles Sass to CSS
        ]
      }
    ]
  },
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
      }),
      new OptimizeCSSAssetsPlugin({})
    ]
  },
  mode: 'production'
});

