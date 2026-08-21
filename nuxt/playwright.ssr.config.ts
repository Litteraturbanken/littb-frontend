import { createPlaywrightConfig } from "./playwright.config"

export default createPlaywrightConfig({
  deploymentEnvironment: "staging",
  readerSourceBase: "http://reader-origin.int.lb.se",
  ssrProject: {
    name: "ssr-staging",
    testMatch: [
      /ssr\/robots\.spec\.ts/,
      /ssr\/deployment-identity\.spec\.ts/
    ]
  }
})
