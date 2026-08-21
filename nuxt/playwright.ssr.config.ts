import { createPlaywrightConfig } from "./playwright.config"

export default createPlaywrightConfig({
  deploymentEnvironment: "staging",
  includeE2eProjects: false,
  ssrProject: {
    name: "ssr-staging",
    testMatch: [
      /ssr\/robots\.spec\.ts/,
      /ssr\/deployment-identity\.spec\.ts/
    ]
  }
})
