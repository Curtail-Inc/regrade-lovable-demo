# ABOUTME: Tiny container that runs the notes Edge Function via Deno on port 8080.
# ABOUTME: Used for local dev and as the app-under-test in GitHub Actions.

FROM denoland/deno:alpine-2.1.4

WORKDIR /app

COPY supabase/functions/notes/index.ts ./index.ts

# Pre-cache deps (currently none beyond stdlib, but future-proof).
RUN deno cache index.ts

EXPOSE 8080

CMD ["deno", "run", "--allow-net", "--allow-env", "index.ts"]
