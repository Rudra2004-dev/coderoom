import "dotenv/config";
import { WebSocket } from "ws";
import { prisma } from "../src/prisma";
import { writeFileSync } from "fs";
import path from "path";

const BASE = process.env.TEST_BASE ?? "http://localhost:4000";
const WS = BASE.replace("http", "ws");
const PASSWORD = "TestPassw0rd!";
const rows: string[] = [];
let failed = 0;

async function call(method: string, p: string, token?: string, body?: unknown, raw?: string) {
  const res = await fetch(BASE + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text, headers: res.headers };
}

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  rows.push(`| ${name} | ${ok ? "✅ Pass" : "❌ FAIL"} | ${detail} |`);
}

const expectStatus = (name: string, r: { status: number }, want: number) =>
  check(name, r.status === want, `expected ${want}, got ${r.status}`);

async function account(email: string, name: string, role: "interviewer" | "candidate") {
  let r = await call("POST", "/auth/login", undefined, { email, password: PASSWORD });
  if (r.status !== 200)
    r = await call("POST", "/auth/register", undefined, {
      email, password: PASSWORD, name, role, inviteCode: process.env.INTERVIEWER_INVITE_CODE,
    });
  if (!r.json?.token) throw new Error(`cannot get a token for ${email}: ${r.status} ${r.text}`);
  return { token: r.json.token as string };
}

// Resolves to the HTTP status the WebSocket handshake got (101 = accepted)
function wsStatus(slug: string, token?: string): Promise<number> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS}/yjs/${slug}${token ? `?token=${token}` : ""}`);
    ws.on("open", () => { ws.close(); resolve(101); });
    ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    ws.on("error", () => resolve(0));
  });
}

async function main() {
  const A = await account("sec-int-a@test.local", "Interviewer A", "interviewer");
  const B = await account("sec-int-b@test.local", "Interviewer B", "interviewer");
  const C = await account("sec-cand-c@test.local", "Candidate C", "candidate");
  const D = await account("sec-cand-d@test.local", "Candidate D", "candidate");

  const room = (await call("POST", "/rooms", A.token)).json;
  const slug: string = room.slug;
  await call("POST", `/rooms/${slug}/join`, C.token);
  const questions = (await call("GET", "/questions", A.token)).json;
  await call("PUT", `/rooms/${slug}/question`, A.token, { questionId: questions[0].id });

  console.log("\n-- Authentication --");
  expectStatus("No token: GET /rooms", await call("GET", "/rooms"), 401);
  expectStatus("No token: GET /rooms/:slug", await call("GET", `/rooms/${slug}`), 401);
  expectStatus("Garbage token", await call("GET", "/rooms", "not.a.token"), 401);
  expectStatus("No token: GET /jobs/1", await call("GET", "/jobs/1"), 401);

  console.log("\n-- Roles --");
  expectStatus("Candidate cannot create rooms", await call("POST", "/rooms", C.token), 403);
  expectStatus("Candidate cannot list questions", await call("GET", "/questions", C.token), 403);
  expectStatus("Candidate cannot list interviews", await call("GET", "/rooms", C.token), 403);
  expectStatus("Candidate cannot read a report", await call("GET", `/rooms/${slug}/report`, C.token), 403);
  if (process.env.INTERVIEWER_INVITE_CODE) {
    const r = await call("POST", "/auth/register", undefined, {
      email: `sec-${Date.now()}@test.local`, password: PASSWORD, name: "Sneaky", role: "interviewer", inviteCode: "wrong-code",
    });
    expectStatus("Interviewer registration needs the invite code", r, 403);
  }

  console.log("\n-- Ownership (IDOR) --");
  expectStatus("Other interviewer: report", await call("GET", `/rooms/${slug}/report`, B.token), 404);
  expectStatus("Other interviewer: room", await call("GET", `/rooms/${slug}`, B.token), 404);
  expectStatus("Other interviewer: pick question", await call("PUT", `/rooms/${slug}/question`, B.token, { questionId: questions[0].id }), 403);
  expectStatus("Other interviewer: end room", await call("POST", `/rooms/${slug}/end`, B.token, { finalCode: "x", language: "python" }), 403);
  expectStatus("Other interviewer: scorecard", await call("POST", `/rooms/${slug}/scorecard`, B.token), 403);
  expectStatus("Outsider candidate: room", await call("GET", `/rooms/${slug}`, D.token), 404);
  expectStatus("Outsider candidate: run", await call("POST", `/rooms/${slug}/run`, D.token, { language: "python", code: "print(1)" }), 403);
  expectStatus("Outsider candidate: submit", await call("POST", `/rooms/${slug}/submit`, D.token, { language: "python", code: "print(1)" }), 403);
  expectStatus("Outsider candidate: question", await call("GET", `/rooms/${slug}/question`, D.token), 403);
  expectStatus("Missing room looks the same as someone else's", await call("GET", "/rooms/doesnotexist/report", A.token), 404);

  console.log("\n-- Validation --");
  expectStatus("Unknown language is rejected", await call("POST", `/rooms/${slug}/run`, C.token, { language: "bash", code: "id" }), 400);
  expectStatus("Empty submit is rejected", await call("POST", `/rooms/${slug}/submit`, C.token, { language: "python", code: "" }), 400);
  expectStatus("Oversized body is rejected", await call("POST", "/auth/login", undefined, undefined, JSON.stringify({ email: "a".repeat(300_000) })), 413);
  expectStatus("Short password is rejected", await call("POST", "/auth/register", undefined, { email: "x@test.local", password: "short", name: "x", role: "candidate" }), 400);

  console.log("\n-- Hidden test data --");
  const q = (await call("GET", `/rooms/${slug}/question`, C.token)).json;
  const hidden = await prisma.testCase.findMany({ where: { questionId: questions[0].id, isHidden: true } });
  const leaked = (q.examples as { input: string }[]).some((e) => hidden.some((h) => h.input === e.input));
  check("Candidate's question response contains no hidden inputs", !leaked && q.hiddenCount === hidden.length, `hidden tests: ${hidden.length}`);
  const roomJson = (await call("GET", `/rooms/${slug}`, C.token)).json;
  check("Room payload carries no final code field", !("finalCode" in roomJson));

  console.log("\n-- Headers --");
  const h = await call("GET", "/health");
  check("X-Content-Type-Options is nosniff", h.headers.get("x-content-type-options") === "nosniff");
  check("X-Powered-By is removed", h.headers.get("x-powered-by") === null);
  const nf = await call("GET", "/nope");
  check("Unknown route returns JSON 404", nf.status === 404 && nf.json?.error === "Not found");

  console.log("\n-- WebSocket --");
  expectStatus("No token", { status: await wsStatus(slug) }, 401);
  expectStatus("Outsider interviewer", { status: await wsStatus(slug, B.token) }, 403);
  expectStatus("Outsider candidate", { status: await wsStatus(slug, D.token) }, 403);
  expectStatus("Member (candidate) is accepted", { status: await wsStatus(slug, C.token) }, 101);

  console.log("\n-- Locking after the end --");
  expectStatus("Candidate cannot end the room", await call("POST", `/rooms/${slug}/end`, C.token, { finalCode: "x", language: "python" }), 403);
  expectStatus("Owner ends the room", await call("POST", `/rooms/${slug}/end`, A.token, { finalCode: "print(1)", language: "python" }), 200);
  expectStatus("Run after the end", await call("POST", `/rooms/${slug}/run`, C.token, { language: "python", code: "print(1)" }), 409);
  expectStatus("Submit after the end", await call("POST", `/rooms/${slug}/submit`, C.token, { language: "python", code: "print(1)" }), 409);
  expectStatus("Pick question after the end", await call("PUT", `/rooms/${slug}/question`, A.token, { questionId: questions[0].id }), 409);
  expectStatus("WebSocket refused after the end", { status: await wsStatus(slug, C.token) }, 409);
  const rep = (await call("GET", `/rooms/${slug}/report`, A.token)).json;
  check("Report keeps the saved final code", typeof rep?.finalCode === "string");

  const md = [
    "| Check | Result | Detail |",
    "|---|---|---|",
    ...rows,
  ].join("\n");
  writeFileSync(path.join(process.cwd(), "tests", "SECURITY.md"), md);
  console.log(`\n${rows.length - failed}/${rows.length} checks passed. Saved to tests/SECURITY.md`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});