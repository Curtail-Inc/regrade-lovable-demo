# regrade-lovable-demo

A self-contained public demo of [ReGrade](https://regrade.curtail.com) catching
authorization regressions in CI, with the app built (or buildable) in
[Lovable](https://lovable.dev) and the CI pipeline running on GitHub Actions.

## What this shows

The toy app is a tiny shared-notes API. Three users (`alice`, `bob`, `charlie`)
own a mix of public and private notes:

| User    | Public notes | Private notes |
|---------|--------------|---------------|
| alice   | "Welcome"    | "alice secret" |
| bob     | "Hi from bob"| "bob secret"  |
| charlie | —            | "charlie secret" |

The auth gate: a user can read their own notes plus any public note. Reading
someone else's private note should return **403**.

`tests.sh` exercises every endpoint, including calls where charlie tries to
read alice's and bob's private notes. Those calls deliberately don't assert a
specific status code — the baseline expects 403, but if a regression on a PR
flips it to 200, ReGrade picks up the behavioral delta and posts the diff as
a PR comment.

## How the pipeline works

`.github/workflows/regrade.yml` has three jobs:

1. **`build-app`** — builds the Deno container, pushes to GHCR tagged with the
   commit SHA so both record and replay can pull the same image.
2. **`regrade-record`** (push to main) — starts the app as a service container,
   runs `tests.sh` through the sensor proxy, uploads the recording to ReGrade.
3. **`regrade-replay`** (pull_request) — replays the baseline recording against
   the PR's app, runs `regrade-analyze` to classify deltas and post a PR
   comment.

Both record and replay run on stock alpine and `curl` the sensor binary plus
`regrade-analyze` script from `app.regrade.curtail.com/downloads/latest` at job
start — no custom container image required.

## Required secrets

- `REGRADE_API_KEY` — get one at [app.regrade.curtail.com → Settings → API
  Keys](https://app.regrade.curtail.com/settings/api-keys), then set it on the
  GitHub repo: **Settings → Secrets and variables → Actions → New repository
  secret**.

`GITHUB_TOKEN` is auto-injected by GitHub Actions. The workflow declares
`pull-requests: write` permission so `regrade-analyze` can post the comment.

## Running locally

```sh
docker build -t notes-demo .
docker run --rm -p 8080:8080 notes-demo

# in another terminal
sh tests.sh
```

## Trying out the demo

1. Push to `main` once — `regrade-record` runs and uploads the baseline.
2. Open a PR that introduces a regression. Easiest one: in
   `supabase/functions/notes/index.ts`, change the auth gate
   ```ts
   if (note.owner_id !== auth.id && note.visibility === "private") {
     return json(403, { error: "forbidden" });
   }
   ```
   to just
   ```ts
   // BUG: removed the auth gate
   ```
3. ReGrade will replay charlie's calls for alice's/bob's private notes, observe
   200 instead of 403, classify the change as a behavioral regression, and post
   a comment on the PR.

## Adding the Lovable frontend

The backend is a single TypeScript file (`supabase/functions/notes/index.ts`)
that runs both as a standalone Deno server (locally / in CI) and as a Supabase
Edge Function (when wired up to a real Supabase project).

To add the Lovable UI:
1. Create a Supabase project, deploy the Edge Function (`supabase functions
   deploy notes`).
2. Open a Lovable project, connect it to this GitHub repo and the Supabase
   project.
3. Build the notes UI in Lovable; it'll commit code into this repo.
4. The CI pipeline keeps working because the backend is unchanged.

## Repo layout

```
.github/workflows/regrade.yml           CI: build → record on main / replay on PRs
supabase/functions/notes/index.ts       Notes API (runs on Deno locally, Supabase in prod)
supabase/migrations/                    (placeholder for the eventual real-DB version)
tests.sh                                Traffic generator that exercises every endpoint
Dockerfile                              Wraps the Deno server for CI
```

## Related

- [ReGrade docs](https://app.regrade.curtail.com/downloads) — install + integration patterns
- [demos/regrade-demo](../regrade-demo) — the equivalent demo for GitLab CI (Flask + GitLab)
