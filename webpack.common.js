const path = require("path")
const CopyWebpackPlugin = require("copy-webpack-plugin")
const HtmlWebPackPlugin = require("html-webpack-plugin")

module.exports = {
    entry: "./app/main.js",
    devServer: {
        host: process.env.LITTB_HOST || "localhost",
        port: process.env.LITTB_PORT || 9000,
        // hot : true,
        proxy: [
            {
                context: [
                    "/api",
                    "/red",
                    "/txt",
                    "/query",
                    "/bilder",
                    "/css",
                    "/sla-bibliografi",
                    "/authordb",
                    "/xhr",
                    "/ws",
                    "/so",
                    "/%C3%B6vers%C3%A4ttarlexikon"
                ],
                target: "http://demolittb.spraakdata.gu.se",
                changeOrigin: true
            },
            {
                context: ["/skolan"],
                target: "htts://litteraturbanken.se",
                changeOrigin: true
            }
        ],
        stats: { colors: true },
        historyApiFallback: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"]
                    }
                }
            },
            {
                test: /\.(sa|sc|c)ss$/,
                use: [
                    "style-loader", // creates style nodes from JS strings
                    {
                        loader: "css-loader",
                        options: {
                            // sourceMap: process.env.NODE_ENV !== "production"
                        }
                    },
                    {
                        loader: "postcss-loader",
                        options: {
                            plugins: () => [require("autoprefixer")]
                            // sourceMap: process.env.NODE_ENV !== "production"
                        }
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            // sourceMap: process.env.NODE_ENV !== "production",
                            // sourceMapContents: false
                        }
                    }
                ]
            },
            {
                test: /\.html$/,
                exclude: /.*index.html/,
                use: [
                    { loader: "file-loader?name=[hash].[name].[ext]" },
                    {
                        loader: "extract-loader",
                        options: { publicPath: "" }
                    },
                    {
                        loader: "html-loader",
                        options: { minimize: true }
                    }
                ]
            },
            {
                test: /fontawesome-webfont\.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
                use: [
                    {
                        loader: "file-loader",
                        options: {
                            name: "[name].[ext]",
                            outputPath: "fonts/" // where the fonts will go
                            // publicPath: '../'       // override the default path
                        }
                    }
                ]
            },
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                exclude: /.*fontawesome-webfont.svg/,
                use: [
                    {
                        loader: "file-loader",
                        options: {
                            name: "[hash].[name].[ext]",
                            outputPath: "img/" // where the fonts will go
                            // publicPath: '../'       // override the default path
                        }
                    }
                    // {
                    //    loader: "svg-url-loader",
                    //    options: {

                    //    }
                    // },
                ]
            }
        ]
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./app/index.html",
            filename: "./index.html"
        }),
        new CopyWebpackPlugin([
            // {
            //   from: "./app/index.html",
            //   to: ".",
            // },
            {
                from: "./app/img/favicons",
                to: "img/favicons"
            },
            {
                from: "./app/img/lb_monogram_white_white.svg",
                to: "img/"
            },
            {
                from: "./app/views/sla/",
                to: "views/sla/"
            }
        ])
    ],
    output: {
        filename: "[contenthash].[name].js",
        path: path.resolve(__dirname, "dist"),
        globalObject: "this"
    }
}
