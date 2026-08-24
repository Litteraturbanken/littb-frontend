import { writeFileSync } from "node:fs"

export default class PlaywrightCollectionReporter {
  onBegin(_config, suite) {
    const outputPath = process.env.LITTB_PLAYWRIGHT_COLLECTION_FILE
    if (!outputPath) {
      throw new TypeError("LITTB_PLAYWRIGHT_COLLECTION_FILE is required")
    }
    writeFileSync(outputPath, JSON.stringify(suite.allTests().map(test => test.id)))
  }
}
