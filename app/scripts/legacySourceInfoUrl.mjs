export function legacySourceInfoUrl({ authorid, titlepath }, work) {
    if (work.mediatype === "infopost") {
        return `/dramawebben/pjäser?om-boken&authorid=${encodeURIComponent(authorid)}` +
            `&titlepath=${encodeURIComponent(titlepath)}#dw`
    }
    return `/författare/${authorid}/titlar/${titlepath}/sida/${work.startpagename}/${work.mediatype}?om-boken`
}
