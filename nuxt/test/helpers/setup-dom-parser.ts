import { DOMParser as LinkedomDOMParser } from "linkedom"

if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = LinkedomDOMParser as unknown as typeof DOMParser
}
