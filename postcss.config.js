const tailwindcss = require("tailwindcss")
const purgecss = require("@fullhuman/postcss-purgecss")
const autoprefixer = require("autoprefixer")

class TailwindExtractor {
    static extract(content) {
        return content.match(/[A-Za-z0-9-_:\/]+/g) || []
    }
}

module.exports = {
    plugins: [
        tailwindcss("./tailwind.js"),
        purgecss({
            content: ["./app/**/*{.html,.js}", "./app/index.html"],
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
        autoprefixer
    ]
}
