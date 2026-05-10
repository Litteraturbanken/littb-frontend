import templateUrl from "../../../views/stats.html?url"
import {
    POPULAR_WORKS_LIMIT,
    getPopularWorkAuthor,
    getPopularWorksQueryOptions,
    getPopularWorkUrl,
    selectPopularWorks
} from "../../features/stats/popularWorks.mjs"

const angular = window.angular
const littb = angular.module("littbApp")

class StatsPageCtrl {
    static $inject = ["backend"]

    constructor(backend) {
        this.backend = backend
    }

    $onInit() {
        const popularWorksOptions = getPopularWorksQueryOptions()

        this.backend.getStats().then(data => (this.statsData = data))

        this.backend
            .getTitles("etext,faksimil,pdf", popularWorksOptions)
            .then(({ titles }) => {
                this.titleList = selectPopularWorks(titles)
            })

        this.backend.getEpub(POPULAR_WORKS_LIMIT).then(({ data }) => (this.epubList = data))
    }

    getPopularWorkAuthor(title) {
        return getPopularWorkAuthor(title)
    }

    getPopularWorkUrl(title) {
        return getPopularWorkUrl(title)
    }
}

littb.component("statsPage", {
    templateUrl,
    controller: StatsPageCtrl
})
