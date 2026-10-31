import { spawn } from "child_process";
import { mkdtemp, writeFile, rm, chmod } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import crypto from "crypto";

export type Language = "python" | "javascript" | "cpp";

export interface JobData {
  language: Language;
  code: string;
  stdin: string;
  userId: string;
  roomSlug: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  compileError: boolean;
  timeMs: number;
}

const MAX_OUTPUT = 64 * 1024;
const COMPILE_MARKER = "COMPILE_FAILED";

const LANGS = {
  python: {
    image: "python:3.12-alpine",
    file: "main.py",
    cmd: ["python", "/app/main.py"],
    memory: "128m", pids: "64", cpus: "0.5",
    tmpfs: "/tmp:rw,noexec,nosuid,size=16m",
    wallMs: 7000,
  },
  javascript: {
    image: "node:20-alpine",
    file: "main.js",
    cmd: ["node", "/app/main.js"],
    memory: "128m", pids: "64", cpus: "0.5",
    tmpfs: "/tmp:rw,noexec,nosuid,size=16m",
    wallMs: 7000,
  },
  cpp: {
    image: "coderoom-cpp",
    file: "main.cpp",
    // Compile (10s limit) then run. Exit code 97 means "compilation failed".
    cmd: [
      "sh", "-c",
      `timeout 10 g++ -O2 -std=c++17 /app/main.cpp -o /tmp/main || { echo ${COMPILE_MARKER} >&2; exit 97; }; /tmp/main`,
    ],
    memory: "512m", pids: "128", cpus: "1",
    tmpfs: "/tmp:rw,exec,nosuid,size=64m", // the binary must be executable
    wallMs: 20000,
  },
} as const;

type LangConfig = (typeof LANGS)[Language];

export async function runInSandbox(data: JobData): Promise<RunResult> {
  const cfg = LANGS[data.language];
  if (!cfg) throw new Error("Unsupported language");

  const dir = await mkdtemp(path.join(tmpdir(), "coderoom-"));
  try {
    await chmod(dir, 0o755);
    await writeFile(path.join(dir, cfg.file), data.code, { mode: 0o644 });
    return await execContainer(dir, cfg, data.stdin);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function execContainer(dir: string, cfg: LangConfig, stdin: string): Promise<RunResult> {
  const name = `cr-${crypto.randomBytes(6).toString("hex")}`;

  const args = [
    "run", "--rm", "-i", "--name", name,
    "--network", "none",
    "--memory", cfg.memory, "--memory-swap", cfg.memory,
    "--cpus", cfg.cpus,
    "--pids-limit", cfg.pids,
    "--read-only",
    "--tmpfs", cfg.tmpfs,
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", "65534:65534",
    "-e", "PYTHONDONTWRITEBYTECODE=1",
    "--mount", `type=bind,source=${dir},target=/app,readonly`,
    cfg.image,
    ...cfg.cmd,
  ];

  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;

    // shell is NOT used: args go straight to docker, so nothing can be injected
    const child = spawn("docker", args);

    const killContainer = () => {
      spawn("docker", ["kill", name]).on("error", () => {});
    };

    // Host-side timer: the real timeout, independent of anything inside the container
    const timer = setTimeout(() => {
      timedOut = true;
      killContainer();
    }, cfg.wallMs);

    const collect = (which: "out" | "err", chunk: Buffer) => {
      if (truncated) return;
      const text = chunk.toString("utf8");
      const current = which === "out" ? stdout : stderr;
      const room = MAX_OUTPUT - current.length;
      const next = current + (text.length > room ? text.slice(0, Math.max(room, 0)) : text);
      if (which === "out") stdout = next; else stderr = next;
      if (text.length > room) {
        truncated = true;
        killContainer(); // an output flood is abuse; stop it
      }
    };

    child.stdout.on("data", (d) => collect("out", d));
    child.stderr.on("data", (d) => collect("err", d));
    child.stdin.on("error", () => {}); // container may exit before reading stdin
    child.stdin.end(stdin);

    const finish = (exitCode: number | null, spawnError?: string) => {
      clearTimeout(timer);
      const compileError = exitCode === 97 && stderr.includes(COMPILE_MARKER);
      resolve({
        stdout,
        stderr: spawnError ?? stderr.replace(`${COMPILE_MARKER}\n`, ""),
        exitCode,
        timedOut,
        truncated,
        compileError,
        timeMs: Date.now() - start,
      });
    };

    child.on("error", (err) => finish(null, `Could not start Docker: ${err.message}`));
    child.on("close", (code) => finish(code));
  });
}