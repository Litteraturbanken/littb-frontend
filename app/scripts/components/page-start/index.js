import startHtml from "../../../views/start.html?raw"

const angular = window.angular
const littb = angular.module("littbApp")

class PageStartCtrl {
    static $inject = ["$location"]

    constructor($location) {
        this.$location = $location
    }

    gotoTitle(query) {
        let url
        if (!query) {
            url = "/titlar"
        } else {
            url = `/titlar?filter=${query}&selectedLetter=${query[0].toUpperCase()}`
        }
        this.$location.url(url)
    }
}

littb.component("pageStart", {
    template: `<div>${startHtml}</div>`,
    controller: PageStartCtrl
})
