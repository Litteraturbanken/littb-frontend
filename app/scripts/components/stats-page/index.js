import templateUrl from "../../../views/stats.html?url"

const angular = window.angular
const littb = angular.module("littbApp")

class StatsPageCtrl {
    static $inject = ["backend"]

    constructor(backend) {
        this.backend = backend
    }

    $onInit() {
        const popularWorksLimit = 30
        const popularWorksFetchSize = 100
        const popularWorksInclude =
            "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain," +
            "main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type," +
            "work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword,authors.authorid,authors.surname,authors.full_name"

        this.backend.getStats().then(data => (this.statsData = data))

        this.backend
            .getTitles("etext,faksimil,pdf", {
                sort_field: "popularity|desc",
                q: "*",
                include: popularWorksInclude,
                partial_string: true,
                author_aggs: true,
                to: popularWorksFetchSize
            })
            .then(({ titles }) => {
                this.titleList = titles.slice(0, popularWorksLimit)
            })

        this.backend.getEpub(popularWorksLimit).then(({ data }) => (this.epubList = data))
    }

    getPopularWorkAuthor(title) {
        return (
            title.main_author ||
            (title.authors && title.authors[0]) ||
            (title.work_authors && title.work_authors[0]) ||
            {}
        )
    }

    getPopularWorkUrl(title) {
        const mediatypes = title.mediatypes || []
        const mediatype =
            mediatypes.find(item => ["etext", "faksimil", "infopost"].includes(item.label)) ||
            mediatypes[0]

        if (mediatype && mediatype.url) {
            return mediatype.url.startsWith("/") ? mediatype.url : `/${mediatype.url}`
        }

        const author = this.getPopularWorkAuthor(title)
        return `/författare/${author.authorid}/titlar/${title.work_titleid || title.titleid}/sida/${
            title.startpagename
        }/${title.mediatype}`
    }
}

littb.component("statsPage", {
    templateUrl,
    controller: StatsPageCtrl
})
