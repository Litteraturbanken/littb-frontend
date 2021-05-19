const path = require("path")
const common = require("./webpack.common.js")
const merge = require("webpack-merge")
const CleanWebpackPlugin = require("clean-webpack-plugin")
const UglifyJsPlugin = require("uglifyjs-webpack-plugin")
const CompressionPlugin = require("compression-webpack-plugin")
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin")
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")

module.exports = merge(common, {
    plugins: [
        new CleanWebpackPlugin(["dist"]),
        new BundleAnalyzerPlugin({
            // creates a report.html in the dist folder.
            analyzerMode: "static",
            openAnalyzer: false
        }),
        new CompressionPlugin({}),
        new CompressionPlugin({
            filename(name) {
                return name.replace(/.gz$/, ".br")
            },
            algorithm: "brotliCompress",
            test: /\.(js|css|html|svg)$/,
            compressionOptions: { level: 11 },
            threshold: 10240,
            minRatio: 0.8,
            deleteOriginalAssets: false
        })
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
    },
    optimization: {
        runtimeChunk: "single",
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: "vendors",
                    chunks: "all"
                }
            }
        }
    }
})
