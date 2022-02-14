const path = require("path")
const devMode = process.env.NODE_ENV !== "production"
// const devMode = true

const CopyWebpackPlugin = require("copy-webpack-plugin")
const HtmlWebPackPlugin = require("html-webpack-plugin")

// const Fiber = require("fibers")

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
                    "/so"
                ],
                target: "https://red.litteraturbanken.se",
                // target: "https://litteraturbanken.se",
                changeOrigin: true
            },
            {
                context: ["/skolan"],
                target: "https://litteraturbanken.se",
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
                test: /\.tsx?$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        configFile: path.resolve(__dirname, "tsconfig.json")
                    }
                },
                exclude: /node_modules/
            },
            {
                test: /\.(sa|sc|c)ss$/,
                use: [
                    // devMode ? "style-loader" : MiniCssExtractPlugin.loader,
                    "style-loader",
                    {
                        loader: "css-loader",
                        options: {
                            // sourceMap: process.env.NODE_ENV !== "production"
                        }
                    },
                    {
                        loader: "postcss-loader",
                        options: {
                            // plugins: [tailwindcss("./tailwind.js"), require("autoprefixer")()]
                            // sourceMap: process.env.NODE_ENV !== "production"
                        }
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            // sourceMap: process.env.NODE_ENV !== "production",
                            // sourceMapContents: false
                            implementation: require("sass")
                            // fiber: Fiber
                        }
                    }
                ]
            },
            {
                test: /\.html$/,
                exclude: /.*index.html/,
                use: [
                    {
                        loader: "file-loader",
                        options: {
                            name: "[hash].[name].[ext]",
                            outputPath: "assets/"
                        }
                    },

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
                            outputPath: "assets/fonts/", // where the fonts will go
                            publicPath: "../assets/fonts/" // override the default path
                        }
                    }
                ]
            },
            {
                test: /\.svg$/i,
                exclude: /.*fontawesome-webfont.svg/,
                use: [
                    {
                        loader: "file-loader",
                        options: {
                            name: "[contenthash].[name].[ext]",
                            outputPath: "assets/img/", // where the fonts will go
                            publicPath: "../assets/img/" // override the default path
                        }
                    },
                    {
                        loader: "svgo-loader"
                    }
                ]
            },
            {
                test: /\.(jpe?g|png|gif)$/i,
                exclude: /.*fontawesome-webfont.svg/,
                use: [
                    {
                        loader: "file-loader",
                        options: {
                            name: "[contenthash].[name].[ext]",
                            outputPath: "assets/img/", // where the fonts will go
                            publicPath: "../assets/img/" // override the default path
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
                to: "assets/img/favicons"
            },
            {
                from: "./app/img/lb_monogram_white_white.svg",
                to: "assets/img/"
            },
            {
                from: "./app/views/sla/",
                to: "assets/views/sla/"
            }
        ])
    ],
    // optimization: {
    //   splitChunks: {
    //     cacheGroups: {
    //       styles: {
    //         name: 'styles',
    //         test: /\.css$/,
    //         chunks: 'all',
    //         enforce: true
    //       }
    //     }
    //   }
    // },
    resolve: {
        alias: {
            "@": path.resolve("app")
        }
    },
    output: {
        filename: "assets/[hash].[name].js",
        path: path.resolve(__dirname, "dist"),
        globalObject: "this",
        publicPath: ""
    }
}
