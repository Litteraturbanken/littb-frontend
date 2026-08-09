const workIdPattern = /^[A-Za-z0-9_-]{1,100}$/
const indexPattern = /^(?:0|[1-9]\d{0,6})$/

export function isEditorRouteIdentity(
  workId: unknown,
  index: unknown,
  mediaType: unknown
): boolean {
  return typeof workId === "string" && workIdPattern.test(workId)
    && typeof index === "string" && indexPattern.test(index)
    && (mediaType === "e" || mediaType === "f")
}
