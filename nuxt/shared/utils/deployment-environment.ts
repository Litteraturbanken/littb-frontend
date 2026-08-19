export type DeploymentEnvironment = "stage" | "production" | "development"

export function normalizeDeploymentEnvironment(
  value: string | undefined
): DeploymentEnvironment | null {
  if (value === "stage" || value === "staging") return "stage"
  if (value === "production") return "production"
  if (value === "development") return "development"
  return null
}
