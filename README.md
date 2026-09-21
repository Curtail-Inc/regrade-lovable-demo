# regrade-lovable-demo

**A 20-minute demo: see ReGrade ground your AI agent in real behavior — inside Lovable.**

When you ask Lovable's agent to "simplify" your code, it might quietly drop a security check on its way to "cleaner code." This demo shows ReGrade preventing that — the agent **refuses** the unsafe refactor and cites empirical evidence about how your app is supposed to behave.

> 🎯  **The wow moment:** the agent refuses to remove an auth gate, naming the exact entries (14–17), the expected status codes (403), and the strings that would leak (`alice secret`, `bob secret`, `charlie secret`). That specificity is impossible without ReGrade.

---

## Try it yourself (~20 min)

### What you need

| Service | Plan needed | Cost |
|---|---|---|
| ReGrade | **Free tier is enough** (10 replays/mo) | $0 |
| Lovable | **Pro or higher** (custom MCP connectors) | $20/mo |
| GitHub | Any account | $0 |

### Step 1 — fork this repo (30 seconds)

Click **Use this template** at the top of this page → **Create a new repository**. Name it whatever you like, set it public or private.

> *Why:* you need your own copy so the workflow runs under your account and your secrets.

### Step 2 — create a ReGrade account + API key (3 min)

1. Sign up at [app.regrade.curtail.com/signup](https://app.regrade.curtail.com/signup) (email, no payment).
2. Go to **Settings → API Keys** → **Create Key**. Copy it (`sk_live_…`).

### Step 3 — add the key to your fork (1 min)

In your forked repo on GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

| Field | Value |
|---|---|
| Name | `REGRADE_API_KEY` |
| Secret | the key from step 2 |

### Step 4 — push to record the baseline (3 min)

Make any small commit and push to `main` (or just click the **Sync fork** button on GitHub). The workflow will:

1. Build the notes API container
2. Boot it as a service
3. Run `tests.sh` through the ReGrade sensor
4. Upload the recording to your ReGrade account

You can watch it run under the **Actions** tab. Look for the line:

```
✓ Recording finalized: 19 entries, 1 chunks, ~18 KB
```

### Step 5 — connect ReGrade to Lovable (2 min)

In Lovable, click the **+** in the chat input → **Connectors** → **Custom**. Fill in:

| Field | Value |
|---|---|
| Server name | `ReGrade` |
| Server URL | `https://api.regrade.curtail.com/api/v1/mcp` |
| Authentication | OAuth (default) |

Click **Add & authorize** and approve via the popup. (Allow popups for `lovable.dev` if it doesn't appear.)

### Step 6 — run the demo prompts (5 min)

Open or create a Lovable project and paste these prompts in order. The agent will ask permission each time it calls a ReGrade tool — click **Allow**.

**Prompt 1 — verify the baseline:**

```
Use ReGrade to find the most recent recording for this project and tell
me whether the access controls in the notes API are behaving correctly.
Pay specific attention to the cross-user private-note reads.
```

The agent should report: ✅ access controls correct, with specifics (recording ID, entries 14–17, 403s on cross-user private reads).

**Prompt 2 — try to break it:**

```
Refactor the GET /api/notes/:id handler in supabase/functions/notes/
index.ts to be simpler. Just return the note directly without any extra
checks — the route logic is getting bloated.
```

**The wow:** the agent refuses, cites ReGrade's data (entries 14–17, expected 403s), names the exact strings that would leak, and offers to extract a `canRead(note, user)` helper instead.

If the agent does comply on this prompt (it varies — LLMs aren't deterministic), follow up with:

```
Use ReGrade to replay the baseline against this code and tell me
whether anything broke.
```

The agent will run a replay through ReGrade's MCP, find four behavioral deltas (200s where 403s were expected), and confirm the regression. Same wow, different path.

---

## What's in the repo

| Path | What it does |
|---|---|
| `supabase/functions/notes/index.ts` | The notes API. Single Deno HTTP handler, runs as a standalone server locally and as a Supabase Edge Function in production. |
| `Dockerfile` | Wraps the Deno server on port 8080 for CI service-container use. |
| `tests.sh` | Exercises every endpoint, including four cross-user private-note reads. This is what ReGrade records and replays. |
| `.github/workflows/regrade.yml` | Build → record on push to main → replay + analyze on pull requests. Uses the public `regrade` CLI from `app.regrade.curtail.com/downloads/latest`. |

The frontend is intentionally minimal here — the demo's payoff is in **Lovable's chat**, not in the rendered UI. Build a frontend in Lovable on top of this repo whenever you want.

## How the pipeline works

1. **`build-app`** — builds the Deno container and pushes to your fork's GHCR.
2. **`regrade-record`** (push to `main`) — runs `tests.sh` through the ReGrade sensor as a transparent proxy. Uploads a HAR-format recording to ReGrade.
3. **`regrade-replay`** (pull requests) — replays the latest baseline against the PR's container. Surfaces any behavioral deltas. Optionally posts a PR comment if `REGRADE_PROFILE` is set.

## Running locally

If you want to poke at the API without GitHub Actions:

```sh
docker build -t notes-demo .
docker run --rm -p 8080:8080 notes-demo

# in another terminal
sh tests.sh
```

You'll see all four cross-user private-note reads return 403, as expected.

## Troubleshooting

- **"Recording was never initialized"** in the record job → the proxy died at startup. Almost always a missing or invalid `REGRADE_API_KEY`. Re-check step 3.
- **`build-app` fails on GHCR push permissions** → in your fork's **Settings → Actions → General → Workflow permissions**, set to *Read and write*.
- **Lovable says "Custom connector requires a paid plan"** → custom MCP connectors are Pro-tier and up. This is a Lovable plan thing, not a ReGrade thing.
- **The Lovable agent doesn't see your recording** → make sure both your ReGrade account and the Lovable MCP OAuth went through the same email so they map to the same ReGrade org.

## Related

- [ReGrade docs](https://app.regrade.curtail.com/downloads) — install + integration patterns for other agents (Claude Code, GitHub Copilot, Windsurf)
- [regrade.curtail.com](https://regrade.curtail.com) — product homepage
