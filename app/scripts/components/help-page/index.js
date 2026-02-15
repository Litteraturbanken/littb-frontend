import templateUrl from "../../../views/help.html?url"

const angular = window.angular
const _ = window._
const $ = window.$
const littb = angular.module("littbApp")

class HelpPageCtrl {
    static $inject = ["$http", "$location"]

    constructor($http, $location) {
        this.$http = $http
        this.$location = $location
    }

    $onInit() {
        const url = "/red/om/hjalp/hjalp.html"
        this.onNavClick = id => {
            this.ankare = id
            this.$location.search("ankare", id)
        }
        this.$http.get(url).then(({ data }) => {
            this.htmlContent = data
            this.labelArray = []
            for (let elem of $("[id]", data).get()) {
                const label = _.str.humanize(
                    $(elem)
                        .attr("name")
                        .replace(/([A-Z])/g, " $1")
                )
                this.labelArray.push({
                    label,
                    id: $(elem).attr("id")
                })
            }
        })
    }
}

littb.component("helpPage", {
    templateUrl,
    controller: HelpPageCtrl
})
