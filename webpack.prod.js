const path = require("path")
const common = require('./webpack.common.js');
const merge = require('webpack-merge');
const glob = require('glob')
const CleanWebpackPlugin = require('clean-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const CompressionPlugin = require("compression-webpack-plugin")
const PurgecssPlugin = require('purgecss-webpack-plugin')

const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");

const PATHS = {
  src: path.join(__dirname, 'app')
}



module.exports = merge(common, {
  plugins: [
    new PurgecssPlugin({
      paths: glob.sync(`${PATHS.src}/**/*`,  { nodir: true }),
      whitelistPatterns : [/page-.*/, /select2/]
    }),
    new CleanWebpackPlugin(['dist']),
    new CompressionPlugin({})
  ],
  module: {
    rules: [
      // {
      //   test: /\.(sa|sc|c)ss$/,
      //   use: [
      //       MiniCssExtractPlugin.loader,
      //       "css-loader", // translates CSS into CommonJS
      //       {
      //         loader: "postcss-loader",
      //         options: {
      //           plugins: () => [require('autoprefixer')]
      //         }
      //       },
      //       "sass-loader" // compiles Sass to CSS
      //   ]
      // }
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

