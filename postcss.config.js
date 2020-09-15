const tailwindcss = require("tailwindcss")
const autoprefixer = require("autoprefixer")

const devMode = process.env.NODE_ENV !== "production"

class TailwindExtractor {
    static extract(content) {
        return content.match(/[A-Za-z0-9-_:\/]+/g) || []
    }
}

module.exports = {
    plugins: [
        tailwindcss("./tailwind.conf.js"),
        // devMode
        //     ? undefined
        //     : purgecss({
        //           content: ["./app/**/*{.html,.js}", "./app/index.html"],
        //           whitelistPatternsChildren: [
        //               /page-.*/,
        //               /select2/,
        //               /modal.*/,
        //               /tooltip.*/,
        //               /site-.*/,
        //               /popup.*/,
        //               /autocomplete/,
        //               /rzslider/,
        //               /rz-.*/,
        //               /content/
        //           ],
        //           extractors: [{ extractor: TailwindExtractor, extensions: ["html", "js"] }]
        //       }),
        autoprefixer
    ]
}
