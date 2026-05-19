import $ from "jquery"
import _ from "lodash"
import underscoreString from "underscore.string"

// Legacy code expects globals.
window.$ = window.jQuery = $
window._ = _
window._.str = underscoreString

import "angularjs-slider/dist/rzslider.css"
import "select2/dist/css/select2.css"

import "./styles/bootstrap.scss"
import "./styles/tailwind.css"
import "font-awesome/scss/font-awesome.scss"
import "./styles/styles.scss"

// IMPORTANT:
// ESM modules execute dependencies before the importer module body.
// We set globals above, so anything that expects window.$/window._/window.angular
// must be loaded *after* this point via dynamic import.
async function boot() {
    // Prevent Angular from auto-bootstrapping before we've loaded and registered all modules.
    // (Angular checks window.name during startup.)
    window.name = "NG_DEFER_BOOTSTRAP!"

    const angularMod = await import("angular")
    const angular = angularMod.default || angularMod
    window.angular = angular

    await import("angular-animate")
    await import("angular-route")
    await import("angular-touch")
    await import("angular-spinner")
    await import("angular-aria")

    await import("./lib/angular-ellipsis.js")
    await import("angularjs-slider")

    // select2's CommonJS build exports an initializer: (root, jQuery) => jQuery
    const select2Mod = await import("select2")
    const initSelect2 = select2Mod.default || select2Mod
    if (typeof initSelect2 === "function") {
        initSelect2(window, window.jQuery)
    }
    await import("angular-ui-select2/src/select2.js")

    await import("./lib/jquery.ui.position.js")
    await import("./lib/angular-locale_sv-se.js")
    await import("./lib/FileSaver.js")

    await import("./scripts/app.js")
    await import("./scripts/util.js")
    await import("./scripts/services.js")
    await import("./scripts/directives.js")
    // await import("./scripts/reading_controller.js")
    await import("./scripts/search_controller.js")
    await import("./scripts/library_controller.js")
    await import("./scripts/dramaweb_controller.js")
    await import("./scripts/controllers.js")
    // await import("./scripts/school.js")

    angular.resumeBootstrap()
}

boot()
