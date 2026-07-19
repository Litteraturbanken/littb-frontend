export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store")
  const author = getRouterParam(event, "author", { decode: true })
  const title = getRouterParam(event, "title", { decode: true })
  const request = parseReaderSourceInfoRequest(author, title, getQuery(event))
  return await loadReaderSourceInfo(
    event,
    request.authorId,
    request.titlePath,
    request.mediaType
  )
})

