const path = require("path")
const common = require("./webpack.common.js")
const merge = require("webpack-merge")
const glob = require("glob")
const CleanWebpackPlugin = require("clean-webpack-plugin")
const UglifyJsPlugin = require("uglifyjs-webpack-plugin")
const CompressionPlugin = require("compression-webpack-plugin")
const PurgecssPlugin = require("purgecss-webpack-plugin")

const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin")

const PATHS = {
    src: path.join(__dirname, "app")
}

module.exports = merge(common, {
    plugins: [
        new PurgecssPlugin({
            paths: glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
            whitelistPatternsChildren: [
                /page-.*/,
                /select2/,
                /modal.*/,
                /tooltip.*/,
                /\.site-.*/,
                /\.content/,
                /\.sect1/
            ]
        }),
        new CleanWebpackPlugin(["dist"]),
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
    // mode: "production",
    mode: "development",
    output: {
        path: path.join(__dirname, "dist")
    }
})
