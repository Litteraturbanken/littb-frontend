const path = require("path")
const common = require("./webpack.common.js")
const merge = require("webpack-merge")
const glob = require("glob-all")
const CleanWebpackPlugin = require("clean-webpack-plugin")
const UglifyJsPlugin = require("uglifyjs-webpack-plugin")
const CompressionPlugin = require("compression-webpack-plugin")
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin")
const PurgecssPlugin = require("purgecss-webpack-plugin")
var Visualizer = require("webpack-visualizer-plugin")
class TailwindExtractor {
    static extract(content) {
        return content.match(/[A-Za-z0-9-_:\/]+/g) || []
    }
}

module.exports = merge(common, {
    plugins: [
        new PurgecssPlugin({
            paths: glob.sync(
                [
                    path.join(__dirname, "app/index.html"),
                    path.join(__dirname, "app/**/*.{html,js}")
                ],
                { nodir: true }
            ),
            whitelistPatternsChildren: [
                /page-.*/,
                /select2/,
                /modal.*/,
                /tooltip.*/,
                /site-.*/,
                /popup.*/
            ],
            extractors: [{ extractor: TailwindExtractor, extensions: ["html", "js"] }]
        }),
        new CleanWebpackPlugin(["dist"]),
        new CompressionPlugin({}),
        new Visualizer()
        // new CompressionPlugin({
        //     filename(name) {
        //         return name.replace(/.gz$/, ".br")
        //     },
        //     algorithm: "brotliCompress",
        //     test: /\.(js|css|html|svg)$/,
        //     compressionOptions: { level: 11 },
        //     threshold: 10240,
        //     minRatio: 0.8,
        //     deleteOriginalAssets: false
        // })
    ],
    module: {
        rules: [
            // {
            //     test: /\.css$/,
            //     use: [MiniCssExtractPlugin.loader, "css-loader"]
            // }
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
        // this is throwing off the order of included css libraries
        // and so has been disabled.
        // splitChunks: {
        //     cacheGroups: {
        //         styles: {
        //             name: "styles",
        //             test: /\.css$/,
        //             chunks: "all",
        //             enforce: true
        //         }
        //     }
        // },
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
    mode: "production",
    output: {
        path: path.join(__dirname, "dist")
    }
})
