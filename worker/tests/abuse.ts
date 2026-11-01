import { execFileSync } from "child_process";
import { writeFileSync } from "fs";
import path from "path";
import { runInSandbox } from "../src/sandbox";
import type { Language, RunResult } from "../src/sandbox";

interface Case {
  language: Language;
  name: string;
  defence: string;
  code: string;
  stdin?: string;
  expect: (r: RunResult) => boolean;
}

const py = (...lines: string[]) => lines.join("\n") + "\n";
const contained = (r: RunResult) => r.timedOut || r.exitCode !== 0;

const CASES: Case[] = [
  // ───────────── Python ─────────────
  { language: "python", name: "Control: normal program", defence: "(sandbox still works)",
    code: py("print(sum(range(11)))"), expect: (r) => r.stdout.trim() === "55" && r.exitCode === 0 },
  { language: "python", name: "Control: stdin", defence: "(sandbox still works)",
    code: py("print(input())"), stdin: "abc\n", expect: (r) => r.stdout.trim() === "abc" },
  { language: "python", name: "Infinite loop", defence: "Host-side timer + docker kill",
    code: py("while True: pass"), expect: (r) => r.timedOut },
  { language: "python", name: "Fork bomb", defence: "--pids-limit 64",
    code: py("import os", "while True:", "    os.fork()"), expect: contained },
  { language: "python", name: "Memory hog", defence: "--memory 128m, swap disabled",
    code: py("x = []", "while True:", "    x.append('a' * 10_000_000)"), expect: (r) => r.memoryExceeded },
  { language: "python", name: "Internet access", defence: "--network none",
    code: py("import urllib.request", "urllib.request.urlopen('http://example.com', timeout=3)"),
    expect: (r) => r.exitCode !== 0 && !r.timedOut },
  { language: "python", name: "Reach host Postgres/Redis", defence: "--network none",
    code: py(
      "import socket",
      "for host, port in [('127.0.0.1', 6379), ('127.0.0.1', 5433), ('host.docker.internal', 5433)]:",
      "    try:",
      "        socket.create_connection((host, port), timeout=2)",
      "        print('CONNECTED', host, port)",
      "    except OSError:",
      "        print('blocked', host, port)"),
    expect: (r) => !r.stdout.includes("CONNECTED") && (r.stdout.match(/blocked/g)?.length ?? 0) === 3 },
  { language: "python", name: "Write to root filesystem", defence: "--read-only",
    code: py("open('/evil.txt', 'w')"), expect: (r) => r.stderr.includes("Read-only file system") },
  { language: "python", name: "Overwrite own source", defence: "Read-only bind mount",
    code: py("open('/app/main.py', 'w')"), expect: (r) => r.stderr.includes("Read-only file system") },
  { language: "python", name: "Fill the disk", defence: "Small tmpfs (16 MB)",
    code: py("with open('/tmp/big', 'wb') as f:", "    while True:", "        f.write(b'a' * 1_000_000)"),
    expect: (r) => r.stderr.includes("No space left") },
  { language: "python", name: "Output flood", defence: "64 KB output cap + kill",
    code: py("while True:", "    print('a' * 1000)"), expect: (r) => r.truncated },
  { language: "python", name: "Run as root?", defence: "--user 65534",
    code: py("import os", "print(os.getuid())"), expect: (r) => r.stdout.trim() === "65534" },
  { language: "python", name: "Leak server secrets", defence: "Clean container environment",
    code: py("import os", "print(sorted(os.environ))"), expect: (r) => !/JWT|DATABASE|SECRET|PASSWORD/i.test(r.stdout) },
  { language: "python", name: "Escalate privileges", defence: "--cap-drop ALL, no-new-privileges",
    code: py("import os", "os.setuid(0)"), expect: (r) => r.stderr.includes("PermissionError") },

  // ───────────── C++ ─────────────
  { language: "cpp", name: "Control: Two Sum with stdin", defence: "(sandbox still works)",
    code: py(
      "#include <bits/stdc++.h>",
      "using namespace std;",
      "int main() {",
      "  vector<int> a; string line; getline(cin, line); stringstream ss(line); int x;",
      "  while (ss >> x) a.push_back(x);",
      "  int t; cin >> t;",
      "  for (size_t i = 0; i < a.size(); i++)",
      "    for (size_t j = i + 1; j < a.size(); j++)",
      "      if (a[i] + a[j] == t) { cout << i << ' ' << j << '\\n'; return 0; }",
      "}"),
    stdin: "2 7 11 15\n9\n", expect: (r) => r.stdout.trim() === "0 1" },
  { language: "cpp", name: "Compile error", defence: "Reported cleanly, no crash",
    code: py("int main( { }"), expect: (r) => r.compileError && r.stderr.length > 0 },
  { language: "cpp", name: "Infinite loop", defence: "Run timer (5 s)",
    code: py("int main() { while (true) {} }"), expect: (r) => r.timedOut },
  { language: "cpp", name: "Fork bomb", defence: "--pids-limit 128",
    code: py("#include <unistd.h>", "int main() { while (true) fork(); }"), expect: contained },
  { language: "cpp", name: "Memory hog", defence: "--memory 512m, swap disabled",
    code: py(
      "#include <cstring>", "#include <vector>",
      "int main() {",
      "  std::vector<char*> keep;",
      "  while (true) { char* p = new char[1 << 26]; memset(p, 1, 1 << 26); keep.push_back(p); }",
      "}"),
    expect: (r) => r.memoryExceeded },
  { language: "cpp", name: "Output flood", defence: "64 KB output cap + kill",
    code: py("#include <cstdio>", "int main() { while (true) puts(\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"); }"),
    expect: (r) => r.truncated },
  { language: "cpp", name: "Compile-time bomb (#include /dev/zero)", defence: "Compile timer + memory limit",
    code: py("#include \"/dev/zero\"", "int main() {}"), expect: (r) => r.compileError || r.timedOut || r.exitCode !== 0 },
  { language: "cpp", name: "Shell out and download", defence: "--network none",
    code: py("#include <cstdlib>", "int main() { system(\"wget -q -T 3 -O- http://example.com || echo no-network\"); }"),
    expect: (r) => r.stdout.includes("no-network") },

  // ───────────── Java ─────────────
  { language: "java", name: "Control: hello", defence: "(sandbox still works)",
    code: py("public class Main { public static void main(String[] a) { System.out.println(\"hello\"); } }"),
    expect: (r) => r.stdout.trim() === "hello" },
  { language: "java", name: "Compile error", defence: "Reported cleanly, no crash",
    code: py("public class Main { void f( }"), expect: (r) => r.compileError && r.stderr.length > 0 },
  { language: "java", name: "Infinite loop", defence: "Run timer (7 s)",
    code: py("public class Main { public static void main(String[] a) { while (true) {} } }"), expect: (r) => r.timedOut },
  { language: "java", name: "Memory hog", defence: "-Xmx256m + --memory 512m",
    code: py(
      "import java.util.*;",
      "public class Main { public static void main(String[] a) {",
      "  List<byte[]> l = new ArrayList<>();",
      "  while (true) l.add(new byte[10_000_000]);",
      "} }"),
    expect: (r) => r.memoryExceeded },
  { language: "java", name: "Thread bomb", defence: "--pids-limit 256",
    code: py(
      "public class Main { public static void main(String[] a) {",
      "  while (true) new Thread(() -> { try { Thread.sleep(1000000); } catch (Exception e) {} }).start();",
      "} }"),
    expect: contained },
  { language: "java", name: "Shell fork bomb via exec", defence: "--pids-limit 256",
    code: py(
      "public class Main { public static void main(String[] a) throws Exception {",
      "  Runtime.getRuntime().exec(new String[]{\"sh\", \"-c\", \":(){ :|:& };:\"});",
      "  Thread.sleep(3000);",
      "  System.out.println(\"done\");",
      "} }"),
    expect: (r) => r.timeMs < 20000 },
  { language: "java", name: "Internet access", defence: "--network none",
    code: py("public class Main { public static void main(String[] a) throws Exception {",
      "  new java.net.URL(\"http://example.com\").openStream();", "} }"),
    expect: (r) => r.stderr.includes("UnknownHostException") },
  { language: "java", name: "Write to root filesystem", defence: "--read-only",
    code: py("public class Main { public static void main(String[] a) throws Exception {",
      "  new java.io.FileOutputStream(\"/evil\");", "} }"),
    expect: (r) => r.stderr.includes("Read-only file system") },
  { language: "java", name: "Output flood", defence: "64 KB output cap + kill",
    code: py("public class Main { public static void main(String[] a) {",
      "  while (true) System.out.println(\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\");", "} }"),
    expect: (r) => r.truncated },
];

function summarize(r: RunResult): string {
  const flags = [
    `exit=${r.exitCode}`,
    r.timedOut && (r.compileTimedOut ? "compile-timeout" : "timeout"),
    r.truncated && "truncated",
    r.memoryExceeded && "oom",
    r.compileError && "compile-error",
    `${r.timeMs}ms`,
  ].filter(Boolean);
  return flags.join(" ");
}

async function main() {
  const filter = process.argv[2]; // optional: python | cpp | java
  const cases = CASES.filter((c) => !filter || c.language === filter);
  const rows: string[] = [];
  let failed = 0;

  for (const c of cases) {
    process.stdout.write(`[${c.language}] ${c.name} ... `);
    let passed = false;
    let observed = "";
    try {
      const r = await runInSandbox({
        language: c.language, code: c.code, stdin: c.stdin ?? "", userId: "abuse-test", roomSlug: "abuse-test",
      });
      passed = c.expect(r);
      observed = summarize(r);
    } catch (e) {
      observed = `worker error: ${(e as Error).message}`;
    }
    if (!passed) failed++;
    console.log(`${passed ? "PASS" : "FAIL"}  (${observed})`);
    rows.push(`| ${c.language} | ${c.name} | ${c.defence} | ${passed ? "✅ Contained" : "❌ FAILED"} | ${observed} |`);
  }

  // Nothing should be left running
  const leftover = execFileSync("docker", ["ps", "-aq", "--filter", "name=^cr-"]).toString().trim();
  const clean = leftover === "";
  console.log(clean ? "\nNo leftover containers ✔" : `\nLEFTOVER CONTAINERS: ${leftover}`);

  const md = [
    "| Language | Attack | Defence | Result | Observed |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    `Leftover containers after the run: ${clean ? "none" : leftover}`,
  ].join("\n");
  writeFileSync(path.join(process.cwd(), "tests", "RESULTS.md"), md);

  console.log(`\n${cases.length - failed}/${cases.length} passed. Table saved to tests/RESULTS.md`);
  process.exit(failed || !clean ? 1 : 0);
}

main();