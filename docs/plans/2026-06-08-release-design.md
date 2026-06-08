# Release Publishing Design

**Date:** 2026-06-08

**Goal:** Add a simple CLI-driven release flow that produces downloadable macOS and Linux binaries for this Electron app and publishes them to GitHub Releases.

## Context

Today, this repo is a small TypeScript Electron app with a single entrypoint in `src/main.ts`.

The current build flow is minimal:

- `yarn build` runs `tsc`
- `yarn start` builds and launches `electron ./dist/main.js`

There is no existing packaging setup, no GitHub Actions workflow, and no release automation for downloadable binaries.

The user wants a CLI-oriented release experience, but the actual packaging should run where it is most reliable. Since macOS artifacts are easiest to build on macOS and Linux artifacts on Linux, GitHub Actions is the most practical primary build environment.

## Scope

This first pass is intentionally narrow:

- Add packaging configuration for the existing Electron app
- Produce downloadable binaries for macOS and Linux
- Publish those artifacts to GitHub Releases
- Keep the user-facing release flow simple through one local CLI command

Out of scope for this pass:

- Windows builds
- Auto-update support
- Code signing
- macOS notarization
- Installer polish beyond standard default targets
- Homebrew, apt, or snap distribution

## Recommended Approach

Use a hybrid release model:

1. A local CLI command creates the version bump, commit, and tag.
2. A GitHub Actions workflow triggered by the version tag builds platform-specific artifacts on native runners.
3. `electron-builder` publishes those artifacts to the matching GitHub Release.

This keeps the user interaction local and simple while avoiding fragile cross-platform local packaging.

## Why This Approach

The repo is small and currently has no release infrastructure. The shortest path to reliable downloads is to let GitHub-hosted runners build on their native operating systems:

- `macos-latest` for macOS artifacts
- `ubuntu-latest` for Linux artifacts

This avoids depending on the user’s local VM layout, Docker cross-builds, or ad hoc upload commands. It also keeps release outputs reproducible and attached to the repository history through version tags.

Compared with a fully local publish flow, GitHub Actions is easier to document, easier to rerun, and less coupled to one machine. Compared with a fully UI-driven release process, a local `yarn release vX.Y.Z` command preserves the CLI workflow the user asked for.

## Proposed Release Shape

### Local CLI Flow

Add a release command that accepts an explicit semantic version tag such as `v1.2.3`.

The command should:

1. Fail if the git worktree is dirty
2. Fail if no version argument is provided
3. Update `package.json` to the requested version without creating an npm tag
4. Commit the version bump
5. Create git tag `vX.Y.Z`
6. Push the commit and tag to the default remote

The command is intentionally thin. It prepares the repository state and delegates artifact production to CI.

### CI Release Flow

Add a workflow in `.github/workflows/release.yml` that triggers on tags matching `v*`.

The workflow should:

- Run one job on `macos-latest`
- Run one job on `ubuntu-latest`
- Install dependencies
- Build artifacts using `electron-builder`
- Publish those artifacts to the GitHub Release for the tag

Each OS job should run independently so failures are isolated and visible by platform.

## Packaging Configuration

### Build Tool

Use `electron-builder` as the packaging and publishing tool. It supports:

- Electron app packaging for macOS and Linux
- GitHub Release publishing
- Native-runner build matrices in GitHub Actions

### App Metadata

Update the package metadata so the packaged app points at the built entrypoint in `dist/`.

The configuration should remain embedded in `package.json` unless the file becomes unwieldy.

### Target Artifacts

For the first pass, generate:

- macOS:
  - `dmg`
  - `zip`
- Linux:
  - `AppImage`
  - `tar.gz`

These targets are enough to provide normal downloadable binaries without adding more distribution complexity.

## Publishing Configuration

Configure `electron-builder` to publish to GitHub Releases for this repository.

The CI workflow should provide GitHub authentication through the standard Actions token environment expected by `electron-builder`.

The release should be associated with the pushed tag and contain the built platform artifacts as downloadable assets.

## Error Handling

### Local Release Command

The local CLI should fail early for:

- Missing version argument
- Invalid version format
- Dirty git worktree
- Failures during version bump, commit, tag creation, or push

This avoids partially prepared releases and keeps remediation obvious.

### CI Workflow

The workflow should fail per platform if packaging or publishing breaks.

Expected failure modes include:

- Dependency install failure
- Packaging misconfiguration
- `electron-builder` publish failure
- Asset upload failure to GitHub Releases

If the workflow fails after the tag is pushed, recovery should be:

- fix the workflow or packaging config
- rerun the workflow if possible, or
- delete and recreate the tag after fixing the issue

## Verification Strategy

### Local Verification

Before using the release command, the repo should support:

- `yarn build`
- a packaging dry run with publishing disabled

This confirms the packaging configuration is structurally valid before a tagged release.

### CI Verification

On a release tag:

- macOS packaging should succeed on `macos-latest`
- Linux packaging should succeed on `ubuntu-latest`
- assets should appear on the GitHub Release for the tag

### User-Facing Success Condition

This design is successful when:

- running `yarn release vX.Y.Z` creates and pushes the version commit and tag
- GitHub Actions builds macOS and Linux artifacts for that tag
- the GitHub Release for `vX.Y.Z` contains downloadable macOS and Linux assets

## Risks

The main risks are packaging age and macOS distribution friction.

This repo currently uses an older Electron version, so modern packaging tools may require careful dependency compatibility checks. The first implementation should keep changes as small as possible and verify that the packaged app still launches.

Unsigned macOS builds are acceptable for this first version, but users should expect the normal Gatekeeper friction associated with unsigned apps.

There is also some operational risk in tag-triggered releases: once a broken tag is pushed, cleanup is more cumbersome than with ordinary CI. That is why the local command should enforce a clean worktree and why dry-run packaging should exist before release.
