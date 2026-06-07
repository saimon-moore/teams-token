# Graph Calendar Token Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend `teams-token` to persist an experimental Microsoft Graph calendar-read token and extend `teams-api` to load and use it for one sample calendar request.

**Architecture:** Keep the existing Electron redirect-interception flow in `teams-token`, add a fourth token type dedicated to Graph, and save it to the existing token directory contract. In `teams-api`, reuse the existing file/env token loading pattern and add a very small Graph calendar client that makes one bearer-authenticated request to `/v1.0/me/calendar/events`.

**Tech Stack:** TypeScript, Electron, axios, Go, net/http, httptest

---

### Task 1: Extend token type definitions in `teams-token`

**Files:**
- Modify: `/home/dev/code/teams-token/src/main.ts`

**Step 1: Write the failing test**

There is no test harness in this repo today. Skip direct automated failure-first coverage here and keep the code change isolated and easy to exercise manually.

**Step 2: Add the Graph token type**

Update the token union and token-state record to include `graph`.

Expected code shape:

```ts
type TeamsSkype = 'teams' | 'skype' | 'chatsvcagg' | 'graph';
```

```ts
const tokens: Record<TeamsSkype, boolean> = {
  teams: false,
  chatsvcagg: false,
  skype: false,
  graph: false,
};
```

**Step 3: Run typecheck/build**

Run: `yarn --cwd /home/dev/code/teams-token build`

Expected: TypeScript compilation succeeds or reports the next missing `graph` branches.

**Step 4: Commit**

```bash
git -C /home/dev/code/teams-token add src/main.ts
git -C /home/dev/code/teams-token commit -m "feat: add graph token type"
```

### Task 2: Add Graph auth request construction in `teams-token`

**Files:**
- Modify: `/home/dev/code/teams-token/src/main.ts`

**Step 1: Add Graph constants**

Add:

```ts
const GRAPH_RESOURCE = 'https://graph.microsoft.com';
const GRAPH_CALENDAR_SCOPE = 'https://graph.microsoft.com/Calendars.Read';
```

**Step 2: Extend `getLoginURL`**

Add a `graph` branch that requests an access token for Graph calendar read access.

Preferred implementation:

- Use a Graph-specific request path isolated from the existing Teams/Skype branches
- Preserve the current redirect URI interception pattern
- Keep the code structured so Graph can later move to its own auth flow

Expected code shape:

```ts
case 'graph':
  loginUrl.searchParams.append('response_type', 'token');
  loginUrl.searchParams.append('state', `${state}|${GRAPH_RESOURCE}`);
  loginUrl.searchParams.append('resource', GRAPH_RESOURCE);
  break;
```

If the implementation moves to `/oauth2/v2.0/authorize`, then request `scope=https://graph.microsoft.com/Calendars.Read` instead and keep that logic scoped to the Graph branch only.

**Step 3: Run build**

Run: `yarn --cwd /home/dev/code/teams-token build`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git -C /home/dev/code/teams-token add src/main.ts
git -C /home/dev/code/teams-token commit -m "feat: request graph calendar token"
```

### Task 3: Extend redirect handling and persistence for Graph

**Files:**
- Modify: `/home/dev/code/teams-token/src/main.ts`

**Step 1: Update redirect handling**

Extend the audience matching logic so Graph access tokens are recognized and persisted.

Expected behavior:

- If the decoded token is a Graph token, save it as `token-graph.jwt`
- Mark `tokens.graph = true`
- Finish the app when all four tokens have been handled

**Step 2: Chain the Graph request after the existing sequence**

After `chatsvcagg` succeeds, call `authorize('graph', currentTenant)`.

**Step 3: Improve error logging**

When Graph auth fails, log:

- `error`
- `error_description`
- requested token type if available

Do not silently ignore Graph auth failures.

**Step 4: Run manual smoke check**

Run: `yarn --cwd /home/dev/code/teams-token start`

Expected:

- Existing login window still opens
- Existing token flow still works
- A Graph acquisition attempt happens after `chatsvcagg`
- If supported, `token-graph.jwt` appears in `~/.config/fossteams`
- If unsupported, the app logs a clear OAuth/consent error

**Step 5: Commit**

```bash
git -C /home/dev/code/teams-token add src/main.ts
git -C /home/dev/code/teams-token commit -m "feat: persist graph calendar token"
```

### Task 4: Add Graph token loading to `teams-api`

**Files:**
- Modify: `/home/dev/code/teams-api/pkg/token.go`
- Test: `/home/dev/code/teams-api/pkg/token_test.go` or extend an existing token-related test file if one is added

**Step 1: Write the failing test**

Add token-loading coverage that mirrors the existing token helper behavior.

Expected test cases:

- load Graph token from `MS_TEAMS_GRAPH_TOKEN`
- load Graph token from `~/.config/fossteams/token-graph.jwt`

**Step 2: Run the targeted test**

Run: `go test ./pkg/...`

Expected: FAIL because `GetGraphToken()` does not exist yet or Graph cases are missing.

**Step 3: Write minimal implementation**

Add:

```go
func GetGraphToken() (*TeamsToken, error) {
	return getToken("graph")
}
```

**Step 4: Re-run tests**

Run: `go test ./pkg/...`

Expected: PASS for token-loading coverage.

**Step 5: Commit**

```bash
git -C /home/dev/code/teams-api add pkg/token.go pkg/token_test.go
git -C /home/dev/code/teams-api commit -m "feat: add graph token loader"
```

### Task 5: Add a minimal Graph calendar client to `teams-api`

**Files:**
- Create: `/home/dev/code/teams-api/pkg/graph/calendar.go`
- Create: `/home/dev/code/teams-api/pkg/graph/calendar_test.go`

**Step 1: Write the failing test**

Use `httptest.Server` to assert that the client:

- sends `Authorization: Bearer ...`
- calls `/v1.0/me/calendar/events`
- decodes a minimal Graph events response

Suggested response body:

```json
{
  "value": [
    {
      "id": "evt-1",
      "subject": "Test event"
    }
  ]
}
```

**Step 2: Run the targeted test**

Run: `go test ./pkg/graph -run TestListMyEvents -v`

Expected: FAIL because the client does not exist yet.

**Step 3: Write minimal implementation**

Create a small client with:

- configurable base URL for tests
- `ListMyEvents()` method
- bearer token auth header
- minimal response struct for `value`

**Step 4: Re-run the targeted test**

Run: `go test ./pkg/graph -run TestListMyEvents -v`

Expected: PASS

**Step 5: Commit**

```bash
git -C /home/dev/code/teams-api add pkg/graph/calendar.go pkg/graph/calendar_test.go
git -C /home/dev/code/teams-api commit -m "feat: add graph calendar client"
```

### Task 6: Add one small integration-style example in `teams-api`

**Files:**
- Modify: `/home/dev/code/teams-api/README.md`
- Optionally create: `/home/dev/code/teams-api/pkg/graph/example_test.go`

**Step 1: Add usage documentation**

Document:

- `token-graph.jwt` location
- `MS_TEAMS_GRAPH_TOKEN`
- the sample calendar call
- the experimental nature of the Graph auth path

**Step 2: If useful, add an example**

Add a minimal example showing:

```go
token, err := api.GetGraphToken()
client := graph.NewCalendarClient(http.DefaultClient, token)
events, err := client.ListMyEvents()
```

**Step 3: Run tests**

Run: `go test ./...`

Expected: PASS

**Step 4: Commit**

```bash
git -C /home/dev/code/teams-api add README.md pkg/graph/example_test.go
git -C /home/dev/code/teams-api commit -m "docs: document graph calendar token usage"
```

### Task 7: Verify the two-repo flow manually

**Files:**
- No code changes required

**Step 1: Build `teams-token`**

Run: `yarn --cwd /home/dev/code/teams-token build`

Expected: PASS

**Step 2: Run `teams-api` tests**

Run: `go test ./...`

Workdir: `/home/dev/code/teams-api`

Expected: PASS

**Step 3: Run end-to-end manual auth smoke**

Run: `yarn --cwd /home/dev/code/teams-token start`

Expected:

- Graph token acquisition attempt happens
- `~/.config/fossteams/token-graph.jwt` is either written or a clear auth error is reported

**Step 4: Run a small local calendar fetch**

Use a one-off Go snippet or example binary that:

- loads `GetGraphToken()`
- calls `ListMyEvents()`

Expected:

- success with event data if Graph token acquisition worked
- clear 401/403/consent-style error otherwise

**Step 5: Final commit sweep**

```bash
git -C /home/dev/code/teams-token status --short
git -C /home/dev/code/teams-api status --short
```

Confirm only intended files changed before any final integration step.
