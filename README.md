# teams-token

A super simple Electron app that will save your Microsoft Teams tokens in `~/.config/fossteams/`.

## Instructions

```bash
yarn install
yarn start
```

## Commands

### Get your token

```bash
yarn start
```

### Switch users

**Warning:** this operation _doesn't_ delete / invalidate your token, but simply clears the cookies of the Electron browser.

```bash
yarn start logout
```

### Get login URL

```bash
yarn start get-url
```

## Release

Run a local packaging smoke test before cutting a release:

```bash
yarn package --linux dir --publish never
```

Publish a release tag from a clean worktree:

```bash
yarn release v1.0.1
```

This command bumps the app version, creates a release commit and git tag, and pushes both. GitHub Actions then builds macOS and Linux binaries and uploads them to the matching GitHub Release.

The first release flow ships unsigned macOS artifacts, so Gatekeeper warnings are expected on download or first launch.

## Note

Log-in with your Microsoft Teams account (your corprorate / school account) and let this app do the rest.
If you don't trust putting your credentials in a random GitHub app, audit the code for yourself: we're basically
using Electron to intercept Oauth redirections and storing the tokens on your computer.

The Microsoft Teams authentication flow is described [here](https://github.com/fossteams/teams-api/blob/master/notes/login-flow.md). We're
getting the token that is passed to `https://teams.microsoft.com/go`.
