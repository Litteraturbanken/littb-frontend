import templateUrl from "../../../views/stats.html?url"

const angular = window.angular
const littb = angular.module("littbApp")

class StatsPageCtrl {
    static $inject = ["backend"]

    constructor(backend) {
        this.backend = backend
    }

    $onInit() {
        this.backend.getStats().then(data => (this.statsData = data))

        this.backend
            .getTitles("etext,faksimil", { sort_field: "popularity|desc", to: 30 })
            .then(({ titles }) => {
                this.titleList = titles
            })

        this.backend.getEpub(30).then(({ data }) => (this.epubList = data))
    }
}

littb.component("statsPage", {
    templateUrl,
    controller: StatsPageCtrl
})
