// ABOUTME: Notes API — login + CRUD over public/private notes with auth gates.
// ABOUTME: Runs locally via `deno serve`, deploys to Supabase as an Edge Function.

interface User {
  id: string;
  username: string;
  password: string;
}

interface Note {
  id: number;
  owner_id: string;
  title: string;
  body: string;
  visibility: "public" | "private";
}

const USERS: User[] = [
  { id: "u_alice", username: "alice", password: "password" },
  { id: "u_bob", username: "bob", password: "password" },
  { id: "u_charlie", username: "charlie", password: "password" },
];

const NOTES: Note[] = [
  { id: 1, owner_id: "u_alice", title: "Welcome", body: "Welcome to Notes", visibility: "public" },
  { id: 2, owner_id: "u_alice", title: "alice secret", body: "alice's private thoughts", visibility: "private" },
  { id: 3, owner_id: "u_bob", title: "Hi from bob", body: "Hi everyone", visibility: "public" },
  { id: 4, owner_id: "u_bob", title: "bob secret", body: "bob's private thoughts", visibility: "private" },
  { id: 5, owner_id: "u_charlie", title: "charlie secret", body: "charlie's private thoughts", visibility: "private" },
];

// Session tokens are minted at login and live only in this process, the way a
// real session store behaves. A token from an earlier run does not exist here,
// so it is rejected.
//
// That is what makes this demo honest about profiles. A replay sends the token
// it recorded, which this process has never issued, and every authenticated
// request comes back 401 unless the profile carries an id mapping teaching the
// sensor to swap the recorded token for the freshly minted one.
const SESSIONS = new Map<string, User>();
const tokenForUser = (u: User) => {
  const token = crypto.randomUUID();
  SESSIONS.set(token, u);
  return token;
};
const userFromToken = (token: string): User | null => SESSIONS.get(token) ?? null;

// Every response carries the time it was served and a fresh request id, the
// way most real APIs do. Both change on every single call, so a replay
// compared against a baseline differs everywhere unless a profile says these
// two are expected to move. That is what a profile is for, and this app is
// where you can watch it work: without one, twenty responses differ and the
// one difference that matters is buried in the noise.
const json = (status: number, body: Record<string, unknown>) =>
  new Response(
    JSON.stringify({ ...body, served_at: new Date().toISOString() }),
    {
      status,
      headers: {
        "content-type": "application/json",
        "x-request-id": crypto.randomUUID(),
      },
    },
  );

const requireAuth = (req: Request): User | Response => {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return json(401, { error: "missing bearer token" });
  const user = userFromToken(m[1]);
  if (!user) return json(401, { error: "invalid token" });
  return user;
};

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/api/health" && req.method === "GET") {
    // Deliberate change: the replay job should report this as a difference
    // from the baseline. It is how this repository proves the shared ReGrade
    // workflow still detects a changed response.
    return json(200, { status: "ok", version: "2" });
  }

  if (path === "/api/login" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const user = USERS.find(
      (u) => u.username === body.username && u.password === body.password,
    );
    if (!user) return json(401, { error: "invalid credentials" });
    return json(200, { token: tokenForUser(user), user_id: user.id, username: user.username });
  }

  if (path === "/api/notes" && req.method === "GET") {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    // Caller sees their own notes plus all public notes from others.
    const visible = NOTES.filter(
      (n) => n.owner_id === auth.id || n.visibility === "public",
    );
    return json(200, { notes: visible });
  }

  const noteMatch = path.match(/^\/api\/notes\/(\d+)$/);
  if (noteMatch && req.method === "GET") {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const id = Number(noteMatch[1]);
    const note = NOTES.find((n) => n.id === id);
    if (!note) return json(404, { error: "not found" });
    // Auth gate: caller must own the note OR the note must be public.
    if (note.owner_id !== auth.id && note.visibility === "private") {
      return json(403, { error: "forbidden" });
    }
    return json(200, { note });
  }

  return json(404, { error: "not found" });
}

Deno.serve({ port: 8080 }, handle);
