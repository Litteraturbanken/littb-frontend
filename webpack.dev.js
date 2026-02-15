const merge = require("webpack-merge")
const common = require("./webpack.common.js")
const webpack = require("webpack")

module.exports = merge(common, {
    // devtool: 'eval-source-map',
    // devtool: 'inline-source-map',
    devtool: "source-map",
    mode: "development",
    // Avoid full-page overlay for non-actionable dev warnings (like asset size hints).
    devServer: {
        client: {
            overlay: {
                errors: true,
                warnings: false
            }
        }
    },
    // The "asset size limit"/"entrypoint size limit" messages are Webpack performance hints.
    // They are useful for production builds, but noisy in development.
    performance: {
        hints: false
    }
    // plugins: [
    //   new webpack.HotModuleReplacementPlugin()
    // ]
})
