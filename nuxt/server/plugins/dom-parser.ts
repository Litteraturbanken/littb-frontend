import { DOMParser as LinkedomDOMParser } from "linkedom"

export default defineNitroPlugin(() => {
  const globals = globalThis as Record<string, unknown>
  if (globals.DOMParser === undefined) {
    globals.DOMParser = LinkedomDOMParser
  }
})
