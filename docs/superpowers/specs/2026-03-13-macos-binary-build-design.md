# macOS Binary Build Design

## Goal

Build the Electrobun desktop app in CI and attach the binary to GitHub releases. Verify the build on PRs.

## Architecture

Electrobun produces macOS `.app` bundles and requires macOS to build. This runs directly on GitHub Actions `macos-latest` runner, not in Dagger (Linux containers can't build macOS apps).

## PR Flow

`ci.yml` gets a new `build-desktop` job:
1. Runs on `macos-latest`
2. Installs Bun
3. Runs `bun install`
4. Runs `bun run prebundle && electrobun build` in the desktop package
5. Verifies the `.app` was produced

## Release Flow

`release.yml` gets a `build-desktop` job after semantic-release:
1. Runs on `macos-latest`
2. Builds the Electrobun app
3. Zips the `.app` bundle
4. Uploads as a release asset to the GitHub release created by semantic-release

## No Code Signing

Unsigned builds for now. Code signing and notarization will be added when an Apple Developer account is available.

## Probot Settings Update

Add `build-desktop` to required status checks for branch protection.
