# AngularJS DI Symbol Modernization Design

## Purpose

The application should preserve AngularJS at runtime while becoming easier to navigate with modern editor tooling. The immediate problem is that many AngularJS dependency-injection entrypoints are anonymous functions or array literals inside registration calls. That shape works at runtime, especially with the existing annotation tooling, but it prevents VS Code "Go to Symbol" and related navigation from treating controllers, factories, directives, filters, config blocks, run blocks, route resolves, and route controllers as first-class named code.

The goal of this refactor is to make every AngularJS dependency-injection entrypoint under `app/scripts` a named symbol with explicit `$inject` metadata, without replacing AngularJS or changing user-visible behavior.

## Current Context

The app is already in a partial modernization state:

- Vite is the primary dev/build path, with Webpack still present as a legacy path.
- `app/main.js` boots legacy globals before importing AngularJS registration modules.
- Some components already use modern named classes with `static $inject`, such as `PageStartCtrl`, `AboutPageCtrl`, and `ContactFormCtrl`.
- The Vite build includes `angularjsAnnotatePlugin()` as build-time protection for AngularJS injection.
- Several major files still contain anonymous or array-style AngularJS DI registrations:
  - `app/scripts/app.js`
  - `app/scripts/services.js`
  - `app/scripts/directives.js`
  - `app/scripts/controllers.js`
  - `app/scripts/search_controller.js`
  - `app/scripts/library_controller.js`
  - `app/scripts/dramaweb_controller.js`
  - `app/scripts/components/reader/reading_controller.js`
  - `app/scripts/components/reader/readingModule.js`

This creates an inconsistent source shape: some parts are editor-friendly, while large runtime-critical areas still hide important definitions inside registration calls.

## Scope

This pass should convert every AngularJS DI registration entrypoint under `app/scripts` that can reasonably be converted without changing behavior.

Included:

- `littb.config(...)` and `littb.run(...)` callbacks.
- `littb.factory(...)`, `littb.service(...)`, `littb.directive(...)`, `littb.filter(...)`, and `littb.controller(...)` callbacks.
- Component controllers declared as inline functions, object methods, or array-style annotations.
- Route controllers and route resolves declared inline inside route definitions.
- The reader module's exported controller array.
- Any anonymous injectable function passed directly to AngularJS registration APIs.

Excluded:

- Ordinary promise callbacks, event handlers, lodash callbacks, and local helper functions that are not AngularJS DI entrypoints.
- Framework replacement work, including Vue migration.
- Broad file splitting that is not needed to expose named symbols.
- TypeScript conversion beyond what is necessary to preserve existing imports.

## Target Pattern

Each AngularJS DI entrypoint should be a named function or class.

Use named functions for config blocks, run blocks, factories, filters, directives, and route resolves:

```javascript
function configureHttp($httpProvider, $locationProvider, $uibTooltipProvider) {
    // existing body
}
configureHttp.$inject = ["$httpProvider", "$locationProvider", "$uibTooltipProvider"]

littb.config(configureHttp)
```

Use classes for component controllers when the surrounding code already follows the `$ctrl`/`this` pattern:

```javascript
class LibraryPageCtrl {
    static $inject = ["$scope", "backend"]

    constructor($scope, backend) {
        // existing body
    }
}

littb.component("libraryPage", {
    templateUrl: libraryUrl,
    controller: LibraryPageCtrl
})
```

Use named controller functions when converting a large legacy controller body to a class would create too much churn:

```javascript
function SearchPageCtrl($scope, $element, backend) {
    const ctrl = this
    // existing body
}
SearchPageCtrl.$inject = ["$scope", "$element", "backend"]
```

For a factory that returns a class, name the AngularJS factory function separately from the returned class:

```javascript
function createSearchDataFactory(backend, $q, $http, $location) {
    return class SearchData {
        // existing body
    }
}
createSearchDataFactory.$inject = ["backend", "$q", "$http", "$location"]

littb.factory("SearchData", createSearchDataFactory)
```

The build-time `angularjsAnnotatePlugin()` should remain for now as an additional guard, but source code should not rely on it for correctness.

## Architecture

The architecture remains AngularJS with ES module registration files. The refactor changes the source structure of AngularJS adapters, not the runtime framework.

Every AngularJS registration should point to an importable or file-local named symbol. This gives editor tooling a stable definition target and makes dependency lists visible in one predictable place.

Large files can remain large in this pass if splitting would increase risk. The primary architectural improvement is a consistent adapter shape:

1. Named symbol contains the existing implementation.
2. `$inject` lives directly next to that symbol.
3. AngularJS registration references the symbol by name.
4. Existing templates, route paths, service names, and component names remain unchanged.

## Data Flow

Runtime data flow should not change.

- Routes still resolve through `ngRoute`.
- Controllers still receive AngularJS services through DI.
- Factories still expose the same service names.
- Directives still return the same directive definition objects.
- Components still bind through the same templates and `$ctrl` names.
- State services and compatibility bridges remain in place.

This pass only makes dependency entrypoints navigable and explicit.

## Error Handling

No new user-visible error handling behavior is intended.

During conversion:

- Preserve existing promise chains and rejection behavior.
- Preserve route resolve rejection behavior, including route reload suppression.
- Preserve `$scope.$on`, `$scope.$watch`, `$rootScope` compatibility, and digest behavior.
- Avoid replacing AngularJS promises with native promises unless a local function already used native promises.

If a conversion uncovers a genuine behavior bug, that bug should be captured with a failing test before fixing it.

## Testing Strategy

Use a test-first guard before changing production code.

Add a unit test that scans `app/scripts` and fails on AngularJS DI anti-patterns. The test should detect:

- Array-style DI registrations at AngularJS registration sites, such as `littb.factory("backend", ["$http", ...])`.
- Anonymous `function (...)` callbacks passed directly to `.config`, `.run`, `.factory`, `.service`, `.directive`, `.filter`, or `.controller`.
- Inline component `controller: function (...)` declarations.
- Inline component `controller: [...]` declarations.
- Inline route `controller: function (...)` declarations.
- Inline route `controller: [...]` declarations.

The guard should avoid flagging non-DI callbacks such as `.then(function (...) {})` and lodash iterator callbacks.

Verification commands:

```bash
yarn test:unit
yarn build
```

If build and unit tests pass, run focused Playwright smoke tests for the most affected pages where practical:

```bash
yarn test:e2e test/e2e/playwright_e2e.spec.js
```

## Migration Rules

- Preserve AngularJS as the runtime.
- Preserve public AngularJS names: module names, service names, directive names, component names, route paths, and template URLs.
- Convert AngularJS DI entrypoints to named functions or classes with explicit `$inject`.
- Prefer the smallest conversion that exposes a stable symbol.
- Do not change ordinary local callbacks merely for style.
- Do not introduce new dependency-injection helper abstractions unless a local pattern already exists.
- Do not remove `angularjsAnnotatePlugin()` in this pass.
- Keep the app buildable after each logical batch.

## Success Criteria

The refactor is complete when:

- All AngularJS DI entrypoints under `app/scripts` are named symbols.
- Each injectable named function/class has explicit `$inject` metadata next to the symbol.
- No source files under `app/scripts` contain array-style AngularJS DI registrations for active code.
- No component or route uses inline injectable controller functions or arrays.
- The new unit guard fails if a future change reintroduces the old style.
- `yarn test:unit` passes.
- `yarn build` passes.

