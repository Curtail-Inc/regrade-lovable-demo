#!/usr/bin/env bash
# ABOUTME: Exercises the notes API end-to-end. Doubles as the ReGrade traffic generator.
# ABOUTME: Some calls intentionally don't assert specific status codes — that's how
# ABOUTME: ReGrade detects when authorization behavior changes between baseline and PR.

set -u
TARGET="${REGRADE_TARGET_URL:-http://localhost:8080}"

login() {
  curl -s -X POST "${TARGET}/api/login" \
    -H 'content-type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"password\"}" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

echo "=== Health ==="
curl -sS "${TARGET}/api/health"
echo

ALICE=$(login alice)
BOB=$(login bob)
CHARLIE=$(login charlie)

echo "=== alice lists notes (sees own + public) ==="
curl -sS -H "authorization: Bearer ${ALICE}" "${TARGET}/api/notes"
echo

echo "=== bob lists notes (sees own + public) ==="
curl -sS -H "authorization: Bearer ${BOB}" "${TARGET}/api/notes"
echo

echo "=== charlie lists notes (sees own + public) ==="
curl -sS -H "authorization: Bearer ${CHARLIE}" "${TARGET}/api/notes"
echo

echo "=== Public note 1 — anyone can read ==="
curl -sS -H "authorization: Bearer ${ALICE}" "${TARGET}/api/notes/1"; echo
curl -sS -H "authorization: Bearer ${BOB}" "${TARGET}/api/notes/1"; echo
curl -sS -H "authorization: Bearer ${CHARLIE}" "${TARGET}/api/notes/1"; echo

echo "=== Owner reads own private note ==="
curl -sS -H "authorization: Bearer ${ALICE}" "${TARGET}/api/notes/2"; echo
curl -sS -H "authorization: Bearer ${BOB}" "${TARGET}/api/notes/4"; echo
curl -sS -H "authorization: Bearer ${CHARLIE}" "${TARGET}/api/notes/5"; echo

# These are the auth-gate calls. We do NOT assert a specific status — we just
# record what happened. Baseline expects 403; a regression that leaks private
# notes will return 200 and ReGrade will flag the behavioral delta.
echo "=== Auth-gate: charlie tries to read alice's private note ==="
curl -sS -H "authorization: Bearer ${CHARLIE}" "${TARGET}/api/notes/2"; echo

echo "=== Auth-gate: charlie tries to read bob's private note ==="
curl -sS -H "authorization: Bearer ${CHARLIE}" "${TARGET}/api/notes/4"; echo

echo "=== Auth-gate: bob tries to read charlie's private note ==="
curl -sS -H "authorization: Bearer ${BOB}" "${TARGET}/api/notes/5"; echo

echo "=== Auth-gate: alice tries to read bob's private note ==="
curl -sS -H "authorization: Bearer ${ALICE}" "${TARGET}/api/notes/4"; echo

echo "=== Missing token rejected ==="
curl -sS "${TARGET}/api/notes"; echo

echo "=== Bad credentials rejected ==="
curl -sS -X POST "${TARGET}/api/login" \
  -H 'content-type: application/json' \
  -d '{"username":"alice","password":"wrong"}'; echo
