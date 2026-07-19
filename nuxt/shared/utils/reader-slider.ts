export interface ReaderSliderGeometryStyles {
  pointerLeft: string
  selectionWidth: string
}

export function readerSliderGeometryStyles(
  percent: number
): ReaderSliderGeometryStyles {
  const clampedPercent = Math.min(100, Math.max(0, percent))
  if (clampedPercent === 0) {
    return { pointerLeft: "0px", selectionWidth: "10px" }
  }

  const pointerOffset = clampedPercent / 5
  const selectionOffset = 10 - pointerOffset
  return {
    pointerLeft: `calc(${clampedPercent}% - ${pointerOffset}px)`,
    selectionWidth: selectionOffset === 0
      ? `${clampedPercent}%`
      : `calc(${clampedPercent}% ${selectionOffset > 0 ? "+" : "-"} ${Math.abs(selectionOffset)}px)`
  }
}
