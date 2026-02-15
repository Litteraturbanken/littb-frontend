import templateUrl from "../../../views/id.html?url"

const angular = window.angular
const _ = window._
const littb = angular.module("littbApp")

class IdPageCtrl {
    static $inject = ["backend", "$routeParams", "$location"]

    constructor(backend, $routeParams, $location) {
        this.backend = backend
        this.$routeParams = $routeParams
        this.$location = $location
    }

    $onInit() {
        _.extend(this, this.$routeParams)
        if (this.id) {
            this.id = this.id.toLowerCase()
        }
        this.titles = []
        if (!_.str.startsWith(this.id, "lb")) {
            this.titles = [this.id]
            this.id = ""
        }

        this.backend.getTitles("etext,faksimil", { to: 10000 }).then(titleArray => (this.data = titleArray))
    }

    idFilter(row) {
        if (!this.id) return true
        return row.lbworkid === this.id
    }

    rowFilter(row) {
        if (!this.titles.length) return true
        return _.some(
            _.map(this.titles, title => {
                if (!title) return false
                return (
                    _.str.contains(row.titlepath.toLowerCase(), title.toLowerCase()) ||
                    _.str.contains(row.title.toLowerCase(), title.toLowerCase())
                )
            })
        )
    }

    textareaChange(titles) {
        this.id = ""
        this.titles = _.map(titles.split("\n"), row => _.str.strip(row.split("\u2013")[1] || row))
    }
}

littb.component("idPage", {
    templateUrl,
    controller: IdPageCtrl
})
