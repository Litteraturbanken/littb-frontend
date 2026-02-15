# E2E Testing Infrastructure - AngularJS Modernization

This document describes the E2E testing setup for validating the AngularJS modernization work.

## Test Framework

- **Framework**: Playwright
- **Config**: `playwright.config.js`
- **Test File**: `test/e2e/playwright_e2e.spec.js`
- **Total Tests**: 40+ tests across 9 describe blocks
- **Server**: Tests run against dev server on `localhost:9000`

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test test/e2e/playwright_e2e.spec.js

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test block
npx playwright test -g "Search"
```

## Domain-Specific Test Subsets

### Search Domain (3 tests)
```bash
npx playwright test -g "Search"
```

**Test Blocks:**
- "Search" - Basic search functionality
- "Search Links" - Search result navigation

**Validates:**
- Text search with filters
- Author/keyword/title filtering
- Search results display
- Navigation to reader from search results

### Library Domain (9 tests)
```bash
npx playwright test -g "Library"
```

**Test Blocks:**
- "Library Authors" - Author browsing
- "Library Works" - Work browsing
- "Library Relevance" - Relevance search
- "Titles" - Title filtering

**Validates:**
- Author filtering and display
- Work filtering (gender, keywords, dates)
- Sort functionality
- Pagination
- Download functionality

### Reader Domain (20+ tests)
```bash
npx playwright test -g "Reader|Parts|Editor"
```

**Test Blocks:**
- "Reader" - Text reader functionality
- "Parts Navigation" - Multi-part work navigation
- "Editor" - Faksimil editor mode

**Validates:**
- Page navigation (prev/next, keyboard shortcuts)
- Faksimil vs etext display
- Search highlighting within works
- Focus mode toggle
- Night mode toggle
- Image prefetching
- Part navigation for multi-volume works

### Full Test Suite (All domains)
```bash
npx playwright test
```

**All Test Blocks:**
1. Search
2. Search Links
3. Library Authors
4. Library Works
5. Library Relevance
6. Titles
7. Reader
8. Parts Navigation
9. Editor

## Testing Protocol for Modernization

### Phase 1 (Foundation)
**When**: After creating state services, before Phase 2 begins
**Command**: `npx playwright test`
**Required**: All 40+ tests must pass
**Purpose**: Establish baseline - ensure state services don't break existing functionality

### Phase 2 (Domain Modernization)
**When**: Before each commit in domain branch
**Command**: Run domain-specific subset
**Examples:**
```bash
# Search specialist before commit
npx playwright test -g "Search"

# Library specialist before commit
npx playwright test -g "Library"

# Reader specialist before commit
npx playwright test -g "Reader|Parts|Editor"
```

**Required**: Domain tests must pass before pushing to branch

### Phase 3 (Integration)
**When**: After merging all domain branches (Day 1)
**Command**: `npx playwright test`
**Required**: Full suite must pass

**When**: After each TypeScript conversion (Days 2-3)
**Command**: `npx playwright test`
**Required**: Full suite must pass

**When**: Before final PR merge (Day 4)
**Command**: `npx playwright test`
**Required**: Full suite must pass + performance validation

## waitForAngular Helper

The test suite uses a custom `waitForAngular` helper that:
- Waits for AngularJS to load
- Waits for injector to be ready
- Waits for initial HTTP requests (up to 2s timeout)
- Does NOT wait for complete stability (some apps have polling)

**Location**: `test/e2e/playwright_e2e.spec.js` (lines 8-70)

## Critical User Flows Tested

1. **Search → Read Flow**
   - Search for text with filters
   - View paginated results
   - Click work title
   - Navigate to reader
   - Verify content displays

2. **Browse → Read Flow**
   - Navigate to library page
   - Filter authors by gender/keywords
   - View work details
   - Open reader from work
   - Verify navigation works

3. **Reader Navigation**
   - Load page in reader
   - Navigate pages (prev/next buttons + keyboard)
   - Navigate parts (multi-volume works)
   - Search within work
   - View hit highlighting
   - Toggle focus mode
   - Toggle night mode

4. **Dictionary Lookup**
   - Select word in reader
   - Trigger dictionary modal
   - View definition
   - Close modal cleanly

## Test Failure Handling

### If tests fail during Phase 1:
1. STOP - do not proceed to Phase 2
2. Debug state service issue
3. Fix and re-run full suite
4. Only proceed when all tests pass

### If tests fail during Phase 2:
1. Domain specialist: debug within your domain
2. If cross-domain issue: escalate to Infrastructure Lead
3. Fix on your branch
4. Re-run domain tests
5. Only push when domain tests pass

### If tests fail during Phase 3:
1. Infrastructure Lead: identify failing domain
2. Review recent changes in that domain
3. Coordinate with domain specialist if needed
4. Fix and re-run full suite

## Performance Validation

**Baseline**: Run before modernization begins
```bash
# Measure page load times
npx playwright test --reporter=json > baseline.json
```

**Final**: Run after Phase 3 completion
```bash
# Compare against baseline
npx playwright test --reporter=json > final.json
```

**Requirement**: Page load times within 5% of baseline

## Visual Regression Testing

Playwright includes screenshot diff capabilities:
```bash
# Update screenshots
npx playwright test --update-snapshots

# Compare screenshots
npx playwright test
```

**Note**: Enable visual regression for critical pages:
- Homepage
- Search results page
- Library browse page
- Reader (faksimil + etext modes)

## Debugging Failed Tests

```bash
# Run with debug mode
npx playwright test --debug

# Generate trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## CI/CD Integration

For automated testing in CI:
```bash
# Install browsers
npx playwright install

# Run headless
npx playwright test --reporter=html

# View HTML report
npx playwright show-report
```

## Contact

**Infrastructure Lead**: Coordinates all test validation
**Domain Specialists**: Run domain-specific tests before commits
