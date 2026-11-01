import { spawn } from "child_process";
import { mkdtemp, writeFile, rm, chmod } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import crypto from "crypto";

export type Language = "python" | "cpp" | "java";

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
  compileTimedOut: boolean;
  truncated: boolean;
  compileError: boolean;
  memoryExceeded: boolean;
  timeMs: number;
}

const MAX_OUTPUT = 64 * 1024;
const MEMORY_HINT = /OutOfMemoryError|MemoryError|bad_alloc/;

interface LangConfig {
  image: string;
  file: string;
  compile?: string; // optional first step
  run: string;
  memory: string;
  pids: string;
  cpus: string;
  tmpfs: string;
  compileMs: number;
  runMs: number;
}

const LANGS: Record<Language, LangConfig> = {
  python: {
    image: "python:3.12-alpine",
    file: "main.py",
    run: "python /app/main.py",
    memory: "128m", pids: "64", cpus: "0.5",
    tmpfs: "/tmp:rw,noexec,nosuid,size=16m",
    compileMs: 0, runMs: 7000,
  },
  cpp: {
    image: "coderoom-cpp",
    file: "main.cpp",
    compile: "g++ -O2 -std=c++17 /app/main.cpp -o /tmp/main",
    run: "/tmp/main",
    memory: "512m", pids: "128", cpus: "1",
    tmpfs: "/tmp:rw,exec,nosuid,size=64m", // the binary must be executable
    compileMs: 15000, runMs: 5000,
  },
  java: {
    image: "eclipse-temurin:21-jdk-alpine",
    file: "Main.java",
    compile: "javac -J-Xmx256m -J-XX:-UsePerfData -d /tmp/out /app/Main.java",
    run: "java -Xmx256m -Xss512k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:-UsePerfData -cp /tmp/out Main",
    memory: "512m", pids: "256", cpus: "1", // the JVM uses many threads
    tmpfs: "/tmp:rw,noexec,nosuid,size=64m", // class files are read, never executed natively
    compileMs: 20000, runMs: 7000,
  },
};

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
  const token = crypto.randomBytes(8).toString("hex");
  const CE = `${token}_CE`;   // compile failed
  const RUN = `${token}_RUN`; // compile finished, program starting

  const steps: string[] = [];
  if (cfg.compile) steps.push(`${cfg.compile} || { echo ${CE} >&2; exit 97; }`);
  steps.push(`echo ${RUN} >&2`);
  steps.push(`exec ${cfg.run}`);
  const script = steps.join("; ");

  const args = [
    "run", "--rm", "-i", "--name", name, "--hostname", "sandbox",
    "--network", "none",
    "--memory", cfg.memory, "--memory-swap", cfg.memory,
    "--cpus", cfg.cpus,
    "--pids-limit", cfg.pids,
    "--ulimit", "nofile=256:256",
    "--ulimit", "core=0",
    "--read-only",
    "--tmpfs", cfg.tmpfs,
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", "65534:65534",
    "-e", "PYTHONDONTWRITEBYTECODE=1",
    "--mount", `type=bind,source=${dir},target=/app,readonly`,
    cfg.image,
    "sh", "-c", script,
  ];

  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let runStarted = !cfg.compile; // Python has no compile phase
    let timer: NodeJS.Timeout | undefined;

    // shell is NOT used on the host: args go straight to docker
    const child = spawn("docker", args);

    const killContainer = () => {
      spawn("docker", ["kill", name]).on("error", () => {});
    };

    // The host-side timer is the real timeout, independent of anything in the container
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        killContainer();
      }, ms);
    };
    arm(cfg.compile ? cfg.compileMs : cfg.runMs);

    const append = (current: string, chunk: Buffer) => {
      const text = chunk.toString("utf8");
      const room = MAX_OUTPUT - current.length;
      if (text.length > room) {
        truncated = true;
        killContainer(); // an output flood is abuse; stop it
        return current + text.slice(0, Math.max(room, 0));
      }
      return current + text;
    };

    child.stdout.on("data", (d: Buffer) => {
      if (!truncated) stdout = append(stdout, d);
    });
    child.stderr.on("data", (d: Buffer) => {
      if (truncated) return;
      stderr = append(stderr, d);
      if (!runStarted && stderr.includes(RUN)) {
        runStarted = true;
        arm(cfg.runMs); // compile finished: start a fresh timer for the run
      }
    });
    child.stdin.on("error", () => {}); // container may exit before reading stdin
    child.stdin.end(stdin);

    const finish = (exitCode: number | null, spawnError?: string) => {
      clearTimeout(timer);
      const compileError = exitCode === 97 && stderr.includes(CE);
      const cleanErr = stderr.replaceAll(`${CE}\n`, "").replaceAll(`${RUN}\n`, "");
      resolve({
        stdout,
        stderr: spawnError ?? cleanErr,
        exitCode,
        timedOut,
        compileTimedOut: timedOut && !runStarted,
        truncated,
        compileError,
        memoryExceeded:
          !timedOut && !truncated && (exitCode === 137 || MEMORY_HINT.test(stderr)),
        timeMs: Date.now() - start,
      });
    };

    child.on("error", (err) => finish(null, `Could not start Docker: ${err.message}`));
    child.on("close", (code) => finish(code));
  });
}