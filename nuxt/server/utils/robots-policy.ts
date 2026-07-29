interface DeploymentRobotsPolicy {
  body: string
  responseHeader: "noindex, nofollow" | null
}

export function deploymentRobotsPolicy(
  deploymentEnvironment: string | undefined
): DeploymentRobotsPolicy {
  if (deploymentEnvironment === "staging") {
    return {
      body: "User-agent: *\nDisallow: /\n",
      responseHeader: "noindex, nofollow"
    }
  }
  return {
    body: "User-agent: *\nAllow: /\n",
    responseHeader: null
  }
}
