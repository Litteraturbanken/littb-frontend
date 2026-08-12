const NEW_TITLES_LOCATION = "/bibliotek?visa=latest&sort=nytillkommet"

export default defineEventHandler(event => {
  const pathname = getRequestURL(event).pathname
  if (pathname !== "/om/aktuellt" && pathname !== "/nytt") return

  return sendRedirect(event, NEW_TITLES_LOCATION, 308)
})
