# GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Vite meadow application from the `main` branch to a public GitHub Pages project site after every push.

**Architecture:** Vite uses the `/meadow-3d/` base only in a dedicated `github-pages` build mode, so local development keeps working at `/`. A GitHub Actions workflow installs locked dependencies, verifies tests, builds in that mode, uploads `dist/`, and deploys it through the official Pages actions.

**Tech Stack:** React, TypeScript, Vite, Vitest, GitHub Actions, GitHub Pages

## Global Constraints

- The GitHub repository is public and named `meadow-3d`.
- Only pushes to `main` and manual workflow dispatches deploy production.
- Existing uncommitted files in `/Users/george/Desktop/Meadow3D` must not be staged or overwritten.
- The deployed project URL uses the `/meadow-3d/` base path.

---

### Task 1: Verify the Pages contract

**Files:**
- Create: `tests/core/pagesDeployment.test.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.app.json`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: Vite build mode and GitHub Actions workflow configuration
- Produces: a production build whose asset URLs resolve under `/meadow-3d/`

- [x] **Step 1: Write the failing test**

Create a Vitest integration suite which invokes the real Vite build in `github-pages` mode and checks that the emitted HTML points at `/meadow-3d/assets/`. Add a second build in the default mode and check that its emitted HTML keeps root-relative `/assets/` URLs for local/standalone builds.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pagesDeployment.test.ts`

Expected: FAIL because the GitHub Pages build still emits root-relative `/assets/` URLs.

- [x] **Step 3: Write minimal implementation**

Set `base` from Vite's config mode: `/meadow-3d/` for `github-pages`, otherwise `/`. Add `.github/workflows/deploy-pages.yml` with `pages: write`, `id-token: write`, concurrency cancellation, a build job on Node 22, and a deploy job using the `github-pages` environment. The workflow runs `npm run build -- --mode github-pages`.

- [x] **Step 4: Run targeted and full verification**

Run: `npm test -- tests/core/pagesDeployment.test.ts`

Run: `npm test && npm run lint && npm run build`

Expected: all commands exit 0 and the dedicated Pages build contains `/meadow-3d/` asset URLs while the default build remains root-relative.

- [ ] **Step 5: Commit**

Stage only the plan, deployment test, Vite config, and workflow. Commit as `ci: deploy main to GitHub Pages`.

### Task 2: Publish and verify production

**Files:**
- No additional source files

**Interfaces:**
- Consumes: authenticated `gh`, commit from Task 1
- Produces: public `ethanjojo/meadow-3d` repository and live Pages URL

- [ ] **Step 1: Create the public repository**

Create `ethanjojo/meadow-3d` with description `A living 3D meadow with dynamic weather, seasons, and a day-night cycle.`

- [ ] **Step 2: Push the deployment commit as `main`**

Add the new repository as `origin` and push `HEAD:main` with upstream tracking.

- [ ] **Step 3: Enable GitHub Pages through Actions**

Configure the repository Pages build type as `workflow` using `gh api` if the initial workflow run requires explicit enablement.

- [ ] **Step 4: Verify deployment**

Watch the `Deploy GitHub Pages` workflow to completion, query Pages status, and request the live URL. Expected: workflow succeeds and the URL returns HTTP 200.

- [ ] **Step 5: Preserve local state**

Fast-forward the original local `main` only if Git can do so without touching existing uncommitted files. Otherwise leave the deployment commit on `agent/github-pages` and report the preserved state.
