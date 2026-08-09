export type KeyboardNavigationDirection = "next" | "previous"
type KeyboardNavigationKind = "adjacent" | "jump" | "part"

export type KeyboardNavigationAction = {
  direction: KeyboardNavigationDirection
  kind: KeyboardNavigationKind
}

export type KeyboardNavigationEvent = Pick<KeyboardEvent, "altKey" | "key" | "shiftKey">

export type KeyboardNavigationOptions = {
  altArrowAction: "part" | null
  atEdge: (direction: KeyboardNavigationDirection) => boolean
  letterAction: "jump" | "part"
}

export type HorizontalScrollMetrics = {
  contentWidth: number
  scrollLeft: number
  viewportWidth: number
}

const horizontalEdgeTolerance = 10

export function horizontalScrollEdge(
  direction: KeyboardNavigationDirection,
  metrics: HorizontalScrollMetrics
): boolean {
  if (direction === "previous") return metrics.scrollLeft < horizontalEdgeTolerance
  return metrics.scrollLeft + metrics.viewportWidth >=
    metrics.contentWidth - horizontalEdgeTolerance
}

const letterDirections = new Map<string, KeyboardNavigationDirection>([
  ["d", "previous"],
  ["F15", "previous"],
  ["f", "previous"],
  ["F16", "next"],
  ["m", "next"],
  ["n", "next"]
])

const arrowDirections = new Map<string, KeyboardNavigationDirection>([
  ["ArrowLeft", "previous"],
  ["ArrowRight", "next"]
])

export function keyboardNavigationAction(
  event: KeyboardNavigationEvent,
  options: KeyboardNavigationOptions
): KeyboardNavigationAction | null {
  const letterDirection = letterDirections.get(event.key)
  if (letterDirection) {
    const adjacent = event.key === "n" || event.key === "f"
    return { direction: letterDirection, kind: adjacent ? "adjacent" : options.letterAction }
  }

  const arrowDirection = arrowDirections.get(event.key)
  if (!arrowDirection) return null
  if (event.altKey && event.shiftKey) return { direction: arrowDirection, kind: "jump" }
  if (event.altKey) {
    return options.altArrowAction
      ? { direction: arrowDirection, kind: options.altArrowAction }
      : null
  }
  return event.shiftKey || options.atEdge(arrowDirection)
    ? { direction: arrowDirection, kind: "adjacent" }
    : null
}
