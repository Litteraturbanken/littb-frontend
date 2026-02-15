import templateUrl from "../../../views/about.html?url"
import helpUrl from "../../../views/help.html?url"
import contactUrl from "../../../views/contactForm.html?url"
import statsUrl from "../../../views/stats.html?url"

const angular = window.angular
const _ = window._
const littb = angular.module("littbApp")

class AboutPageCtrl {
    static $inject = ["$location", "$routeParams", "$scope"]

    constructor($location, $routeParams, $scope) {
        this.$location = $location
        this.$routeParams = $routeParams
        this.$scope = $scope
    }

    $onInit() {
        _.extend(this, this.$routeParams)
        this.page = this.$routeParams.page

        this.$scope.$on("$routeChangeError", (event, current, prev, rejection) => {
            _.extend(this, current.pathParams)
        })
    }

    getPage(page) {
        return {
            ide: "/red/om/ide/omlitteraturbanken.html",
            hjalp: helpUrl,
            "mål": "/red/om/visioner/visioner.html",
            kontakt: contactUrl,
            statistik: statsUrl,
            rattigheter: "/red/om/rattigheter/rattigheter.html",
            tack: "/red/om/tack.html",
            organisation: "/red/om/ide/organisation.html",
            "english.html": "/red/om/ide/english.html",
            "deutsch.html": "/red/om/ide/deutsch.html",
            "francais.html": "/red/om/ide/francais.html"
        }[page]
    }
}

littb.component("aboutPage", {
    templateUrl,
    controller: AboutPageCtrl
})
