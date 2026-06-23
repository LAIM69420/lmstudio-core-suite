import * as cp from "node:child_process";
import { runInDocker } from "./dockerRunner.js";

// ---------------------------------------------------------------------------
// Language runners — subprocess mode
// ---------------------------------------------------------------------------

type Runner = (code: string, timeoutMs: number) => Promise<string>;

const subprocessRunners: Record<string, Runner> = {
  python: async (code, t) => runWithStdin("python3", code, t),
  javascript: async (code, t) => runWithStdin("node", "--input-type=module", code, t),
  rust: async (code, t) => runRustSubprocess(code, t),
  shell: async (code, t) => runWithStdin("bash", code, t),
};

function runWithStdin(
  cmd: string,
  argOrCode: string,
  codeOrTimeout: string | number,
  timeoutArg?: number,
): Promise<string> {
  const arg: string | undefined =
    typeof argOrCode === "string" && typeof codeOrTimeout === "string" ? argOrCode : undefined;
  const code = typeof codeOrTimeout === "string" ? codeOrTimeout : argOrCode as string;
  const timeout = typeof timeoutArg === "number" ? timeoutArg : typeof codeOrTimeout === "number" ? codeOrTimeout : 30000;
  const args = arg ? [arg] : [];

  return new Promise((resolve, reject) => {
    const proc = cp.execFile(cmd, args, {
      timeout,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: undefined },
    } as cp.ExecFileOptionsWithBufferEncoding);

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: string) => { stdout += chunk; });
    proc.stderr?.on("data", (chunk: string) => { stderr += chunk; });
    proc.on("error", (err) => reject(new Error(`Failed to start ${cmd}: ${err.message}`)));
    proc.on("close", (exitCode) => {
      const combined = [stdout, stderr].filter(Boolean).join("\n");
      if (exitCode === 0) {
        resolve(stdout || "(no output)");
      } else {
        // Enhanced error: try to extract line numbers
        const errorDetail = extractLineNumbers(stderr, cmd);
        resolve(`Exit code ${exitCode}\n${errorDetail}\n${combined || "(no output)"}`);
      }
    });

    if (proc.stdin) {
      proc.stdin.write(code);
      proc.stdin.end();
    }
  });
}

/** Rust subprocess: write to temp file, compile, run. */
async function runRustSubprocess(code: string, timeoutMs: number): Promise<string> {
  const { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const tmpDir = mkdtempSync(join(tmpdir(), "rust-"));
  const srcFile = join(tmpDir, "main.rs");
  const binFile = join(tmpDir, "prog");

  try {
    writeFileSync(srcFile, code, "utf-8");

    // Compile
    const compileOut = cp.execFileSync("rustc", [srcFile, "-o", binFile], {
      timeout: timeoutMs / 2,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });

    // Run (capture both stdout and stderr separately)
    const runOut = cp.execFileSync(binFile, [], {
      timeout: timeoutMs / 2,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });
    return runOut.stdout || runOut || "(no output)";
  } catch (err: any) {
    if (err.stdout || err.stderr) {
      const combined = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
      return `Exit code ${err.status}\n${combined || "(no output)"}`;
    }
    return `Rust error: ${err.message || err}`;
  } finally {
    try { unlinkSync(srcFile); } catch {}
    try { unlinkSync(binFile); } catch {}
    try { rmdirSync(tmpDir); } catch {}
  }
}

/** Attempt to extract line numbers from compiler/interpreter errors. */
function extractLineNumbers(stderr: string, cmd: string): string {
  if (!stderr) return "";
  const lines = stderr.split("\n").filter((l) => l.trim());

  // Python: "File "<stdin>", line N"
  // Node: "SyntaxError: ... (<stdin>:N)"
  const lineMatches = lines.filter((l) => /line\s+\d+/i.test(l) || /:\d+:\d+/.test(l));
  if (lineMatches.length > 0) {
    return `[Error detail]\n${lineMatches.slice(0, 5).join("\n")}`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Docker dispatch
// ---------------------------------------------------------------------------

let useDocker = true;
let dockerMemoryLimit = "512m";
let dockerCpuLimit = 1.0;

export function setDockerConfig(opts: {
  enabled: boolean;
  memoryLimit?: string;
  cpuLimit?: number;
}): void {
  useDocker = opts.enabled;
  if (opts.memoryLimit) dockerMemoryLimit = opts.memoryLimit;
  if (opts.cpuLimit !== undefined) dockerCpuLimit = opts.cpuLimit;
}

async function runWithDocker(language: string, code: string, timeoutMs: number): Promise<string> {
  return runInDocker(language, code, timeoutMs, {
    memoryLimit: dockerMemoryLimit,
    cpuLimit: dockerCpuLimit,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const ALLOWED = new Set(["python", "javascript", "rust", "shell"]);

export function isAllowedLanguage(lang: string): lang is keyof typeof subprocessRunners {
  return lang in subprocessRunners;
}

export function getAllowedLanguages(configAllowed: string): string[] {
  if (configAllowed === "all") return [...ALLOWED];
  if (ALLOWED.has(configAllowed)) return [configAllowed];
  return [];
}

export async function runCode(
  language: string,
  code: string,
  timeoutMs: number,
  maxOutputChars: number,
): Promise<string> {
  if (!isAllowedLanguage(language)) {
    return `Unsupported language: "${language}". Supported: ${Object.keys(subprocessRunners).join(", ")}`;
  }

  try {
    const result = useDocker
      ? await runWithDocker(language, code, timeoutMs)
      : await subprocessRunners[language](code, timeoutMs);

    const trimmed =
      result.length > maxOutputChars
        ? result.slice(0, maxOutputChars) +
          `\n... (output truncated at ${maxOutputChars} chars)`
        : result;
    return trimmed;
  } catch (err) {
    return `Execution error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
