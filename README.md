# CodeRoom

A live technical interview platform. An interviewer and a candidate share a real-time code editor, run code in
isolated Docker sandboxes (Python, C++, Java), get automatic grading against hidden test cases, and the interviewer
receives an AI-assisted scorecard.

![CodeRoom demo](docs/demo.gif)

**Video (2 min):** <<YouTube or Drive link>> · **Live demo:** <<https://your-link, or delete this line>>

## Why I built it

Platforms like CoderPad and HackerRank have to do two hard things: run code written by strangers safely, and keep two
people's editors in sync. I wanted to build both end to end, then attack my own solution and record where it held and
where it didn't.

## Features

- **Real-time collaborative editor:** Monaco + Yjs (CRDT) with named cursors. The language and the stdin box are shared too.
- **Sandboxed execution** for Python, C++ and Java in Docker, with separate compile and run time limits.
- **Auto-grading:** 5 seeded questions with visible and hidden test cases, one queue job per test, run in parallel across a worker pool.
- **Hidden tests stay hidden:** inputs and expected outputs never leave the server. Candidates see only a verdict.
- **AI scorecard** (Groq): schema-validated JSON, one retry on bad output, and prompt-injection defences.
- **Interviewer dashboard:** every interview, every attempt, per-test results, the final code and the scorecard.
- **Role-based access** (interviewer / candidate) with per-room authorization on both REST and WebSocket.

## Screenshots


| Live Interview | Grading |
|:---:|:---:|
| ![room](docs/room.png) | ![grading](docs/grading.png) |

| Scorecard | Dashboard |
|:---:|:---:|
| ![scorecard](docs/scorecard.png) | ![dashboard](docs/dashboard.png) |


## Architecture

```mermaid
flowchart LR
  B["Browser<br/>React + Monaco"] -- "REST" --> API["Express API"]
  B -- "WebSocket (Yjs)" --> API
  API --> PG[("PostgreSQL")]
  API -- "enqueue job" --> R[("Redis / BullMQ")]
  R --> W["Worker"]
  W -- "docker run" --> S["Sandbox container<br/>no network, read-only, limits"]
  API -- "scorecard prompt" --> G["Groq API"]
```

**Run:** the API validates the request, checks room membership and rate limits, and enqueues one job. The worker runs
it in a fresh container and returns the result. The client polls the job, then publishes the output into the shared
Yjs document so both people see it.

**Submit:** the API enqueues one job per test case. The first test runs alone, so a compile error costs one container
and not N. The remaining tests run in parallel. Outputs are compared on the server, hidden tests are reduced to a
verdict, and the sanitized result is stored and returned.

**End interview:** the server saves its own copy of the code from the live Yjs document, marks the room ended, closes
every socket, and refuses new connections to that room. Scoring is a separate request, so an AI outage can never stop
an interview from ending.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Monaco Editor |
| Real-time | Yjs (CRDT), y-websocket 2.x, authenticated WebSocket upgrade |
| Backend | Node.js, Express 5, Zod, Prisma 6 |
| Data | PostgreSQL 16, Redis 7 |
| Queue and workers | BullMQ, Docker |
| AI | Groq (OpenAI-compatible API), default model `openai/gpt-oss-20b` (set with `GROQ_MODEL`) |
| Auth | JWT, bcrypt, role checks, optional invite code for interviewer accounts |

## Security model

### What untrusted code can try, and what stops it

| Attack | Defence |
|---|---|
| Infinite loop | Host-side timer plus `docker kill`. The timeout is enforced outside the container |
| Fork bomb / thread bomb | `--pids-limit` |
| Memory exhaustion | `--memory` with swap disabled; JVM `-Xmx` kept below the container limit |
| Network access, reaching the database | `--network none` |
| Writing files, filling the disk | `--read-only`, small `tmpfs`, read-only source mount |
| Privilege escalation | `--cap-drop ALL`, `no-new-privileges`, non-root user, Docker's default seccomp profile |
| Output flooding | 64 KB output cap, then the container is killed |
| Compiler abuse (`#include "/dev/zero"`) | Separate compile timer and memory limit |
| Faking a compile error | Per-job random markers the program cannot guess |
| Command injection | `spawn` with an argument array (no shell) and a language allowlist |

**Evidence:** an automated suite of **31 scenarios (27 attacks and 4 control runs that confirm the sandbox still works)
across Python, C++ and Java. All 31 passed, with no leftover containers.** See
[`worker/tests/RESULTS.md`](worker/tests/RESULTS.md). The suite calls the sandbox directly. Some attacks are contained by
the timeout and not by an immediate failure, and the "Observed" column records what actually happened.

### Application security

An automated suite of **38 checks** covers authentication, roles, ownership (IDOR), input validation, hidden test-data
leaks, security headers and WebSocket authorization: **38 of 38 passing**. See
[`server/tests/SECURITY.md`](server/tests/SECURITY.md). (One more check runs when an invite code is configured.)

- Hidden test cases are filtered **on the server**. Their inputs and expected outputs never reach a browser, including
  through `GET /jobs/:id` (grading jobs are blocked there) and the stored results.
- Every room route checks **membership**, not only login. Room and report lookups return `404` for non-members, so
  slugs cannot be probed.
- Login always runs one bcrypt comparison, so a known and an unknown email take similar time.
- After an interview ends, the server refuses new WebSocket connections and keeps its own copy of the code.
- Startup refuses to run with a weak `JWT_SECRET`. Responses carry `helmet` headers and errors never include stack traces.
- Rate limits: login and register 20 per 15 min per IP; run 15 per min, submit 6 per min and scorecard 10 per hour per
  user; 600 per min per IP overall. The queue refuses work above 50 waiting jobs. Request bodies are capped at 200 KB
  and WebSocket messages at 1 MB, with at most 6 sockets per room.

### AI scorecard design

- **Correctness is computed from test results**, not by the model, so it cannot be talked into a different number.
- The candidate's code is treated as untrusted data in the prompt (delimited, with instructions not to follow it).
- The model's output is validated with Zod. On failure it is sent back once with the reason, then rejected.
- The candidate's name is not sent to the model. Communication is not scored, because it is not observed.
- The scorecard shows which numbers are measured and which are model estimates. It assists the interviewer and is not
  a hiring decision.

## Known limitations

- **Docker containers share the host kernel.** A kernel exploit could escape them. Systems that run hostile code at scale
  use gVisor or Firecracker microVMs. This is the top item under future work.
- **Interviewer sign-up is open by default.** The API supports an optional `INTERVIEWER_INVITE_CODE`, but the sign-up
  form does not ask for it, so leave it unset. Anyone can therefore create an interviewer account and use sandbox
  compute. Rate limits bound the damage, and ownership checks still keep interviews private.
- **Live results are published by the browser.** The grade and run output shown during a session is written into the
  shared Yjs document by the client, so a malicious participant could display a fake result. The stored submissions, the
  dashboard and the scorecard use server-computed results only.
- The JWT is stored in `localStorage` (an XSS bug would expose it), and the WebSocket token travels in the URL query
  string. Production fixes: httpOnly cookies and short-lived single-use WebSocket tickets.
- Yjs documents live in server memory and are not persisted while a room is open. Abandoned rooms that never end stay in
  memory until the server restarts. The final code is read from the server's copy and falls back to the browser's copy
  only if the server has none.
- The in-process locks (`grading`, `scoring`) and rate limiters are per server process. Running several API instances
  would need Redis-backed versions.
- C++ and Java recompile for every test case, and grading uses `Promise.all`, so one failed job fails the submission.
- Code is sent to a third-party LLM provider for scoring, which would need consent in a real product.

## Performance

Burst benchmark: all jobs submitted at once, one warm-up run excluded. Machine: <<CPU, RAM, Windows + Docker Desktop>>.
Measured with [`worker/tests/load.ts`](worker/tests/load.ts).

<<paste the table from worker/tests/BENCHMARK.md>>

Most of the latency for small programs is container startup, since every run uses a fresh container. A warm pool of
pre-started containers is the next optimization.

## Run it locally

Requirements: Node 20+ and Docker (Docker Desktop on Windows or macOS).

```bash
git clone <<repo url>>
cd coderoom

# PostgreSQL on port 5433, Redis on port 6379
docker compose up -d

# sandbox images (first run only)
docker pull python:3.12-alpine
docker pull eclipse-temurin:21-jdk-alpine
docker build -t coderoom-cpp -f worker/docker/cpp.Dockerfile worker/docker

# API and WebSocket server
cd server
cp .env.example .env        # then edit it (see the table below)
npm install
npx prisma migrate deploy
npm run seed                # 5 questions, 30 test cases
npm run dev                 # http://localhost:4000

# worker (new terminal)
cd worker && npm install && npm run dev

# client (new terminal)
cd client && npm install && npm run dev    # http://localhost:5173
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

| Variable (`server/.env`) | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://coderoom:coderoom@localhost:5433/coderoom` for the compose file above |
| `JWT_SECRET` | Required. At least 32 characters, and not the placeholder value |
| `PORT` | Default `4000` |
| `CLIENT_ORIGIN` | Default `http://localhost:5173` (used for CORS) |
| `GROQ_API_KEY` | Optional. Without it everything works except scorecards |
| `GROQ_MODEL` | Optional. Default `openai/gpt-oss-20b` |
| `INTERVIEWER_INVITE_CODE` | Optional. Leave unset (see Known limitations) |

Then register one **interviewer** account in a normal window and one **candidate** account in a private window. The
interviewer creates a room and shares the code, and the candidate pastes it on their home page.

### Tests

```bash
cd worker && npx tsx tests/abuse.ts                  # sandbox attacks (needs Docker)
cd server && npm run test:security                   # access rules (server must be running)
cd worker && npx tsx tests/load.ts python 30 2       # language, job count, worker-concurrency label
```

The security suite creates four `sec-*@test.local` accounts the first time it runs and reuses them. Delete them
afterwards if you don't want them.

## API overview

| Route | Who | Purpose |
|---|---|---|
| `POST /auth/register`, `POST /auth/login` | Anyone | Create an account, get a JWT |
| `POST /rooms`, `GET /rooms` | Interviewer | Create a room, list your interviews |
| `GET /rooms/:slug` | Room members | Room details (no final code) |
| `POST /rooms/:slug/join` | Candidate | Join a room |
| `GET /questions`, `PUT /rooms/:slug/question` | Interviewer | List questions, choose one for the room |
| `GET /rooms/:slug/question` | Room members | The active question, visible examples only |
| `POST /rooms/:slug/run`, `GET /jobs/:id` | Room members | Run code, poll the result |
| `POST /rooms/:slug/submit` | Room members | Grade against all test cases |
| `POST /rooms/:slug/end` | Room's interviewer | End the interview and save the final code |
| `GET`/`POST /rooms/:slug/scorecard` | Room's interviewer | Read or generate the scorecard |
| `GET /rooms/:slug/report` | Room's interviewer | Attempts, results, final code, scorecard |
| `WS /yjs/:slug?token=...` | Room members | Shared document and cursors |

## Deploying

`docker-compose.prod.yml` binds PostgreSQL and Redis to `127.0.0.1` only (Docker publishes ports around the host
firewall, so a plain `6379:6379` would expose Redis publicly). The API sets `trust proxy` for use behind a reverse
proxy, and the client switches to `/api` and `/yjs` paths outside development. The worker needs access to the host's
Docker, so run it as a plain process on the same machine rather than inside a container.

## Project structure

```
client/   React app: pages, components, Yjs hook
server/   Express API, Yjs WebSocket server, grading, scorecard service, Prisma schema, security tests
worker/   BullMQ worker, the Docker sandbox runner, abuse and load tests
```

## Future work

gVisor or Firecracker isolation · warm container pool · compile-once grading · server-computed live results ·
more languages and questions · session replay · video calls · httpOnly cookies and WebSocket tickets · persisted Yjs
documents · Redis-backed locks and rate limits · an organization and invitation model.

## What I learned

Most of what I learned came from things going wrong. A Windows Postgres service and my Docker container were both
listening on port 5432, and `netstat` and `tasklist` showed me which process Prisma was actually talking to. Writing the
sandbox taught me that a timeout has to be enforced from outside the thing being timed. Hidden test data can leak
through side doors, like a job-status endpoint, and not only through the endpoint you were thinking about. A
single-threaded server can still race across an `await`, which I hit in the submit lock. And prompt injection made me
stop trusting a model with the one number that matters, so correctness is computed from test results instead.
