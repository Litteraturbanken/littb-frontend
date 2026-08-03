export type TextSearchOwnedRequest = Readonly<{
  identity: string
  revision: number
  signal: AbortSignal
}>

export type TextSearchRequestOwner = Readonly<{
  start: (identity: string) => TextSearchOwnedRequest
  isCurrent: (request: TextSearchOwnedRequest, currentIdentity: string) => boolean
  finish: (request: TextSearchOwnedRequest) => boolean
  cancel: () => void
}>

export function createTextSearchRequestOwner(): TextSearchRequestOwner {
  let revision = 0
  let current: Readonly<{
    controller: AbortController
    request: TextSearchOwnedRequest
  }> | null = null

  function cancel(): void {
    revision += 1
    current?.controller.abort()
    current = null
  }

  return {
    start(identity) {
      cancel()
      const controller = new AbortController()
      const request = Object.freeze({
        identity,
        revision,
        signal: controller.signal
      })
      current = { controller, request }
      return request
    },
    isCurrent(request, currentIdentity) {
      return current?.request === request
        && request.revision === revision
        && request.identity === currentIdentity
        && !request.signal.aborted
    },
    finish(request) {
      if (current?.request !== request) return false
      current = null
      return request.revision === revision && !request.signal.aborted
    },
    cancel
  }
}
