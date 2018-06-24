const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './app/index.js',
    module: {
        rules: [
            {
              test: /\.coffee$/,
              use: [
                {
                  loader: 'coffee-loader'
                }
              ]
            },
            {
              test: /\.css$/,
              use: [
                'style-loader',
                "css-loader"
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
             test: /fontawesome-webfont\.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
             use: [{
               loader: 'file-loader',
               options: {
                 name: '[name].[ext]',
                 outputPath: 'fonts/',    // where the fonts will go
                 // publicPath: '../'       // override the default path
               }
             }]
           },
           {
             test: /\.(jpe?g|png|gif|svg)$/i,
             exclude: /.*fontawesome-webfont.svg/,
             use: [
             {
                loader: "file-loader",
                options: {
                     name: '[name].[ext]',
                     outputPath: 'img/',    // where the fonts will go
                     // publicPath: '../'       // override the default path
                 }
             },
             // {
             //    loader: "svg-url-loader",
             //    options: {

             //    }
             // },
             ]

           },
        ]
    },
    plugins: [
        
        new CopyWebpackPlugin([
          {
            from: "./app/index.html",
            to: ".",
          },
          {
            from: "./app/img/favicons",
            to: "img",
          },
          {
            from: "./app/views/sla/",
            to: "views/sla/",
          }
      ])
    ],
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      globalObject: "this"
    }
}