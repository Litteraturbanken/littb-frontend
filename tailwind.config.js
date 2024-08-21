/*
 ** TailwindCSS Configuration File
 **
 ** Docs: https://tailwindcss.com/docs/configuration
 ** Default: https://github.com/tailwindcss/tailwindcss/blob/master/stubs/defaultConfig.stub.js
 */
module.exports = {
    content: ["./app/**/*.js", "./app/**/*.html"],
    theme: {
        extend: {
            opacity: {
                85: "0.85",
                90: "0.90"
            },
            colors: {
                // neutral gray
                gray: {
                    100: "#f5f5f5",
                    200: "#eeeeee",
                    300: "#e0e0e0",
                    400: "#bdbdbd",
                    500: "#9e9e9e",
                    600: "#757575",
                    700: "#616161",
                    800: "#424242",
                    900: "#212121"
                },
                primary: "#7A1400"
            }
        }
    },
    variants: {},
    plugins: []
}
