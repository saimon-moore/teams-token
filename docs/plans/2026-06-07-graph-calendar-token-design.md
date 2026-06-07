# Graph Calendar Token Design

**Date:** 2026-06-07

**Goal:** Extend the existing Electron login helper so it can attempt to acquire a Microsoft Graph access token with read-only calendar permissions, persist it alongside the existing Teams JWTs, and let `teams-api` consume that token for one simple calendar read call.

## Context

Today, `teams-token` drives a legacy Microsoft login redirect flow and saves three tokens:

- `token-teams.jwt`
- `token-skype.jwt`
- `token-chatsvcagg.jwt`

The implementation is centered in `src/main.ts`. It hard-codes the supported token types, constructs `/oauth2/authorize` URLs for those types, and accepts only three audiences on the redirect back to `https://teams.microsoft.com/go`.

`teams-api` does not perform interactive login. It reads token files or environment variables through `pkg/token.go` and uses those bearer tokens for Teams and Skype API calls.

## Scope

This first pass is intentionally narrow:

- Add an experimental fourth token type, `graph`
- Target Microsoft Graph read-only calendar access
- Persist the token as `~/.config/fossteams/token-graph.jwt`
- Add `teams-api` support for loading that token
- Add one small read-only Graph calendar request in `teams-api`

Out of scope for this pass:

- Refresh tokens
- Write access to calendar data
- Broad Graph client abstractions
- Replacing the existing login flow with MSAL or auth-code-with-PKCE

## Recommended Approach

Use the existing legacy Electron redirect flow as the first implementation vehicle, but isolate Graph-specific handling so the code can later move to a dedicated Graph auth flow if needed.

This means:

1. `teams-token` keeps its current login window and redirect interception model.
2. A new Graph token request is appended after the existing Teams token sequence succeeds.
3. `teams-api` treats the Graph token as just another bearer token loaded from the standard token directory.
4. A minimal Graph calendar client is added for `GET /v1.0/me/calendar/events`.

## Why This Approach

It is the smallest useful patch and preserves the current user experience. The repos already assume tokens are written to `~/.config/fossteams`, so adding `token-graph.jwt` fits the current contract cleanly.

At the same time, Microsoft’s current guidance recommends avoiding implicit flow for new implementations and using auth code flow instead. Graph permissions are scope-based, and Microsoft Graph calendar access is typically requested with delegated scopes such as `https://graph.microsoft.com/Calendars.Read`. That makes the Graph addition the most likely place where the current Teams-first login flow may fail due to client registration or consent behavior.

By keeping the Graph logic isolated, the fallback is straightforward: if the current Teams client cannot obtain the Graph token, replace only the Graph acquisition path with a dedicated app registration and modern auth flow.

## Proposed Auth Shape

### `teams-token`

Add a new logical token type:

- `graph`

Add a new Graph resource constant:

- `https://graph.microsoft.com`

Add Graph-specific authorize URL construction:

- Request an access token, not an ID token
- Request Microsoft Graph delegated calendar read access
- Preserve the existing redirect interception model

Persist the result as:

- `~/.config/fossteams/token-graph.jwt`

Update the completion logic so the app exits only after all requested tokens have been collected.

### `teams-api`

Add:

- `GetGraphToken()` in `pkg/token.go`

Add a minimal Graph calendar client:

- `GET https://graph.microsoft.com/v1.0/me/calendar/events`
- `Authorization: Bearer <graph token>`

Keep the API intentionally small so that failures are obvious and easy to debug.

## Data Flow

1. User launches `teams-token`.
2. Existing Teams login sequence runs.
3. After the current Teams/Skype/ChatSvcAgg sequence, the app requests a Graph token.
4. Redirect handler inspects the returned token.
5. If the token audience matches Graph and the request succeeded, save it to `token-graph.jwt`.
6. `teams-api` loads the saved Graph token through a new helper.
7. A sample Graph calendar call uses that bearer token to list the signed-in user’s events.

## Error Handling

The first pass should treat Graph acquisition failures as explicit, diagnosable failures rather than trying to silently recover.

Expected failure modes:

- OAuth error returned instead of an access token
- Consent prompt denied or blocked by tenant policy
- Token issued without the expected Graph audience
- Token issued without usable calendar scopes

The Electron app should log the returned OAuth error fields and stop cleanly. `teams-api` should return normal HTTP and decode errors from the sample Graph request.

## Testing Strategy

For `teams-token`:

- Add unit-level coverage where practical for the login URL builder and token-type flow sequencing
- Avoid live auth tests in the automated suite

For `teams-api`:

- Add tests for Graph token loading through the same file/env pattern
- Add a request-construction test for the calendar call against an `httptest` server

## Risks

The main risk is not code complexity. It is auth compatibility.

The current Electron flow uses a legacy Teams-oriented setup. Microsoft’s current docs still describe implicit token acquisition, but they recommend authorization code flow instead for new applications. The existing Teams client identity may or may not be able to obtain delegated Microsoft Graph calendar access in the same way it currently obtains Teams-related tokens.

If that fails, the fallback design is:

- Keep `teams-api`’s Graph consumer
- Keep the `token-graph.jwt` contract
- Replace only the Graph acquisition path in `teams-token` with a dedicated Graph app registration and a modern auth flow

## Success Criteria

This design is successful when:

- `teams-token` attempts to acquire and save `token-graph.jwt`
- `teams-api` can load that token through a dedicated helper
- `teams-api` can make one read-only Graph calendar request with it
- Failures clearly distinguish auth/consent issues from local code bugs
