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

// Bearer tokens are username:password base64 — trivial for the demo, NOT for production.
const tokenForUser = (u: User) => btoa(`${u.username}:${u.password}`);
const userFromToken = (token: string): User | null => {
  try {
    const [username, password] = atob(token).split(":");
    return USERS.find((u) => u.username === username && u.password === password) ?? null;
  } catch {
    return null;
  }
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

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
    return json(200, { status: "ok" });
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
    // BUG (intentional, for the demo): the auth gate has been removed,
    // so any authenticated user can read any private note.
    return json(200, { note });
  }

  return json(404, { error: "not found" });
}

Deno.serve({ port: 8080 }, handle);
