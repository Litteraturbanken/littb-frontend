const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './app/index.js',
    module: {
        rules: [
            {
              test: /\.(jpe?g|png|gif|svg)$/i,
              loader: "file-loader?name=[name].[ext]&outputPath=img/"
            },
            {
              test: /\.coffee$/,
              use: [
                {
                  loader: 'coffee-loader'
                }
              ]
            },
            {
              test: /\.scss$/,
              use: [
                    "style-loader", // creates style nodes from JS strings
                    "css-loader", // translates CSS into CommonJS
                    "sass-loader" // compiles Sass to CSS
                ]
            },
            {
              test: /\.html$/,
              use: [
                { loader: "file-loader?name=[name].[ext]" },
                { 
                  loader: "extract-loader",
                  options: { publicPath: "" }
                },
                { loader: "html-loader" }
              ]
              
            },
            {
              test: /\.otf$/i,
              loader: "file-loader"
            },
            {
              test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
              loader: "file-loader?mimetype=application/font-woff"
            },
            {
              test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
              loader: "file-loader?mimetype=application/font-woff"
            },
            {
              test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
              loader: "file-loader?mimetype=application/octet-stream"
            },
            {
              test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
              loader: "file-loader"
            },
        ]
    },
    plugins: [
        
        new CopyWebpackPlugin([
          {
            from: "./app/index.html",
            to: path.resolve(__dirname, 'dist'),
          },
          {
            from: "./app/img/favicons",
            to: path.resolve(__dirname, 'dist/img'),
          }
      ])
    ],
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      globalObject: "this"
    }
}