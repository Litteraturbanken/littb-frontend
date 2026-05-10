export const POPULAR_WORKS_LIMIT = 30
export const POPULAR_WORKS_FETCH_SIZE = 100

export const POPULAR_WORKS_INCLUDE =
    "lbworkid,titlepath,title,titleid,work_titleid,texttype,shorttitle,mediatype,searchable,imported,sort_date_imprint.plain," +
    "main_author.authorid,main_author.surname,main_author.full_name,main_author.birth,main_author.death,main_author.name_for_index,main_author.type," +
    "work_authors.authorid,work_authors.surname,startpagename,has_epub,sort_date.plain,export,keyword,authors.authorid,authors.surname,authors.full_name"

export function getPopularWorksQueryOptions() {
    return {
        sort_field: "popularity|desc",
        q: "*",
        include: POPULAR_WORKS_INCLUDE,
        partial_string: true,
        author_aggs: true,
        to: POPULAR_WORKS_FETCH_SIZE
    }
}

export function selectPopularWorks(titles = [], limit = POPULAR_WORKS_LIMIT) {
    return titles.slice(0, limit)
}

export function getPopularWorkAuthor(title = {}) {
    return (
        title.main_author ||
        (title.authors && title.authors[0]) ||
        (title.work_authors && title.work_authors[0]) ||
        {}
    )
}

export function getPopularWorkUrl(title = {}) {
    const mediatypes = title.mediatypes || []
    const mediatype =
        mediatypes.find(item => ["etext", "faksimil", "infopost"].includes(item.label)) ||
        mediatypes[0]

    if (mediatype && mediatype.url) {
        return mediatype.url.startsWith("/") ? mediatype.url : `/${mediatype.url}`
    }

    const author = getPopularWorkAuthor(title)
    return `/författare/${author.authorid}/titlar/${title.work_titleid || title.titleid}/sida/${
        title.startpagename
    }/${title.mediatype}`
}
