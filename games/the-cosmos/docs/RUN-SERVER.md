# Run the shared Cosmos world on the MSI

This change is uncommitted. Claude should apply the SQL, start the process using the MSI's external secrets file, and verify the public address. No database migration or deployment was performed by this build.

## Production start

Use Node **24.5 or newer** (the runtime uses `node:module.registerHooks`). From the repository's `games/the-cosmos` directory:

```powershell
node server/index.mjs
```

No npm install is needed for the authority: Node provides HTTP/WebSocket transport and the runtime resolves browser `three` imports to the repository's vendored module. Keep the repository's `homes/people` assets available for browser player bodies.

Before starting, load these variables into the server process from the existing MSI secrets file:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Never put either value in source, browser configuration, screenshots or command output. The server refuses to start with missing/partial production credentials. It never silently substitutes a fresh local world after a database failure.

Apply [server/migration.sql](../server/migration.sql) to the existing Supabase project before starting. It creates `cosmos_*` tables and `cosmos_load` / `cosmos_save` RPCs. RLS and grants restrict access to the server service role. It is an unapplied SQL file, **not** a verified live migration; Claude must check execution and REST RPC availability on the real project.

Optional process variables:

| Variable | Default / purpose |
| --- | --- |
| `COSMOS_WORLD_ID` | `marineris`; stable database world key. Keep it unchanged to resume this world. |
| `COSMOS_PORT` | `8390` |
| `COSMOS_ALLOWED_ORIGINS` | Comma-separated additional exact browser origins if the website uses another hostname |

The HTTP/WebSocket listener binds to `127.0.0.1:8390`. The existing Cloudflare tunnel maps `https://cosmos.heartbeatobservatory.com` to it. Production browsers connect to `wss://cosmos.heartbeatobservatory.com`; pages served on localhost/127.0.0.1 connect to `ws://localhost:8390`. The authority also serves the game at its HTTP root and the Loft people assets. Server source, private saves and dot files are excluded from HTTP serving.

Check `http://localhost:8390/health` on the MSI, then `https://cosmos.heartbeatobservatory.com/health`. Healthy output says `ok: true` and `storage: SupabaseAdapter`, with a revision and connected count. A persistence fault produces HTTP 503 and pauses transactions. Inspect safe error messages; do not log secrets or raw credential-bearing requests.

Run **one process for this world**. Postgres revision checks guard competing writes; they do not coordinate two running simulators. Configure the MSI's existing service/task supervisor to start on boot, restart on failure and run with the required working directory/environment. No supervisor configuration was installed here. Graceful SIGINT/SIGTERM checkpoints before closing. A process crash loses ordinary movement since the latest two-second checkpoint; accepted money/hire/terrain actions were committed before success replies.

Restart catch-up simulates elapsed time. Trips, ship danger and crew wages advance while the server was down. A long outage can take substantial time to simulate; measure recovery on the MSI before treating extended outages as tested.

## Local adapter and QA

For an explicit local test without database access:

```powershell
$env:COSMOS_LOCAL_STORE = '1'
node server/index.mjs
```

Supabase variables take precedence if present. Use a test process environment without them to choose FileAdapter. This writes `server/.data/world.json`, ignored by git and inaccessible through HTTP. Keep that file to resume the same local test world. It is not the production database and is never automatically imported into it.

```powershell
node test/validate.mjs
node test/multiplayer-browser.mjs
```

The validator includes the two-client protocol/restart/write-failure tests and mocked Supabase RPC checks. The browser script needs Playwright and Chrome; set `COSMOS_PLAYWRIGHT_ROOT` to an absolute module-resolution directory such as `C:/path/to/node_modules/` (include the trailing slash), and `COSMOS_CHROME` to the Chrome executable if the MSI differs from the script defaults. It requires free ports 8390 and 8383, uses a temporary FileAdapter, and writes screenshots/results to [the multiplayer QA folder](qa/2026-10-01/multiplayer/REVIEW.md). It does not use or overwrite a live database.

Use `?test=1` on the game URL for a second persistent device identity and owned ship in the same browser. Normal visits use the regular device identity. Edit the displayed name in the World panel. `?dev=1` exposes AI review tools; normal play hides that handle and free-camera controls. There is no authority teleport endpoint.

## Public deployment acceptance

After SQL and startup, test two different browsers/devices through the website: their own distinct ships/pads, mutually visible movement, a shared hole, exclusive hiring, owner-permitted boarding, a shared Phobos trip and a passenger refresh. Restart the production process and confirm the same identities, ship IDs, purse, crew and hole. Check a deliberate disconnect displays reconnecting; unavailable startup must explicitly show offline solo. Review service logs and health for durable-write failures.

Local evidence is in [REVIEW.md](qa/2026-10-01/multiplayer/REVIEW.md). Actual Supabase persistence, real public WebSockets, phones, frame rates and extended downtime recovery remain deployment checks.

## Graphics diagnostics and the October 2 two-player check

Use `?tier=safe` for the WebGL1 compatibility mode: no log depth or floating-point environment targets, simplified materials and animated suit figures, capped textures/DPR, fewer lights, and a 2 km far plane. A shader failure, lost context, GPU memory error, or three clear-only frame probes displays a graphics problem line and reloads once into safe mode. The shared identity and world state survive the reload. A failure within safe mode stays visible without a reload loop.

The authority accepts a bounded `client-error` message from a joined client. It appends JSON lines to `server/.data/client-errors.log`, with one rotated `.log.1` backup after 1 MiB. Records contain UTC time, graphics reason/compile log, GPU renderer, browser family and tier. No player name, device identity, IP address, page URL, or stack is recorded; the HTTP server cannot serve this directory. Check this file on the MSI after Kurtis's next test. Restart the authority with these changes for the message handler to exist.

`node test/validate.mjs` includes the full two-player browser checks as well as deterministic hull, boarding, jitter and recovery checks. `node test/twoplayer-browser.mjs` reruns just the browser harness. It starts an isolated authority on a free loopback port, uses temporary FileAdapter storage, injects 80–200 ms delivery jitter plus packet bunching into two real Chromium clients, then runs a SwiftShader phone viewport with 4x CPU throttling. Evidence goes to [the October 2 review](qa/2026-10-02/twoplayer/REVIEW.md). It never connects to the production Supabase world. Diagnostic isolation switches used by this test are `webgl=1`, `logdepth=0`, `env=0`, `shadows=0`, and `far=2000`; the normal low tier leaves those features on. The matrix disables each suspect separately and together, probes rendered pixels, and exercises shader, blank-frame, context-loss and synthetic memory recovery. Real Mali hardware and actual memory exhaustion still require a phone test.
