module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Keep the authored module graph acyclic.",
      severity: "error",
      from: {},
      to: { circular: true }
    },
    {
      name: "production-not-to-tests",
      comment: "Production modules cannot depend on test code or fixtures.",
      severity: "error",
      from: { path: "^(app|server|shared)/" },
      to: { path: "(^|/)(test|tests|fixtures?)(/|$)" }
    },
    {
      name: "app-not-to-server",
      comment: "Browser-capable app modules cannot import server implementation modules.",
      severity: "error",
      from: { path: "^app/" },
      to: { path: "^server/" }
    },
    {
      name: "library-not-to-ui",
      comment: "Reusable app libraries cannot depend on pages or components.",
      severity: "error",
      from: { path: "^app/lib/" },
      to: { path: "^app/(pages|components)/" }
    }
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled", "npm-no-pkg"]
    },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default"],
      exportsFields: ["exports"]
    }
  }
}
