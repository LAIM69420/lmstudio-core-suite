import * as cp from "node:child_process";

// ---------------------------------------------------------------------------
// Docker-based code runner
// Each execution spins up a fresh container, pipes code via stdin,
// captures stdout/stderr, and removes the container.
// ---------------------------------------------------------------------------

interface DockerConfig {
  memoryLimit: string;        // e.g. "512m"
  cpuLimit: number;           // e.g. 1.0
}

const DOCKER_IMAGES: Record<string, string> = {
  python: "python:3-slim",
  javascript: "node:22-slim",
  rust: "rust:1-slim",
  shell: "ubuntu:24.04",
};

export function hasDockerImage(lang: string): boolean {
  return lang in DOCKER_IMAGES;
}

function waitForContainer(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = cp.execFile(cmd, args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      env: { ...process.env, NODE_OPTIONS: undefined },
    } as cp.ExecFileOptionsWithBufferEncoding);

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: string) => { stdout += chunk; });
    proc.stderr?.on("data", (chunk: string) => { stderr += chunk; });
    proc.on("error", (err) => reject(new Error(`Docker error: ${err.message}`)));
    proc.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout || "(no output)");
      } else {
        const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
        resolve(`Exit code ${exitCode}\n${combined || "(no output)"}`);
      }
    });

    if (proc.stdin) {
      proc.stdin.end();
    }
  });
}

export async function runInDocker(
  language: string,
  code: string,
  timeoutMs: number,
  config: DockerConfig,
): Promise<string> {
  const image = DOCKER_IMAGES[language];
  if (!image) {
    throw new Error(`No Docker image configured for language: ${language}`);
  }

  // Determine the command to run inside the container
  const langCmd: Record<string, string[]> = {
    python: ["python3", "-c", code],
    javascript: ["node", "--input-type=module", "-e", code],
    rust: ["sh", "-c", `cat > /tmp/main.rs && rustc /tmp/main.rs -o /tmp/prog 2>/dev/null && /tmp/prog`],
    shell: ["bash", "-c", code],
  };

  const cmdArgs = langCmd[language];
  if (!cmdArgs) throw new Error(`No runner for language: ${language}`);

  // Build docker run args
  const dockerArgs = [
    "run",
    "--rm",
    "-i",
    "--network", "none",
    "--memory", config.memoryLimit,
    "--cpus", String(config.cpuLimit),
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    image,
    ...cmdArgs,
  ];

  // For rust: pipe code via stdin to write to /tmp/main.rs first
  if (language === "rust") {
    // We'll use a different approach for rust: cat code via heredoc
    const rustArgs = [
      "run", "--rm", "-i",
      "--network", "none",
      "--memory", config.memoryLimit,
      "--cpus", String(config.cpuLimit),
      "--read-only",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=128m",
      image,
      "sh", "-c",
      `cat > /tmp/main.rs && rustc /tmp/main.rs -o /tmp/prog 2>&1 && /tmp/prog`,
    ];

    return new Promise((resolve, reject) => {
      const proc = cp.execFile("docker", rustArgs, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      } as cp.ExecFileOptionsWithBufferEncoding);

      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (chunk: string) => { stdout += chunk; });
      proc.stderr?.on("data", (chunk: string) => { stderr += chunk; });
      proc.on("error", (err) => reject(new Error(`Docker error: ${err.message}`)));
      proc.on("close", (exitCode) => {
        if (exitCode === 0) {
          resolve(stdout || "(no output)");
        } else {
          const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
          resolve(`Exit code ${exitCode}\n${combined || "(no output)"}`);
        }
      });

      if (proc.stdin) {
        proc.stdin.write(code);
        proc.stdin.end();
      }
    });
  }

  // For other languages: pipe code directly
  return new Promise((resolve, reject) => {
    const proc = cp.execFile("docker", dockerArgs, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    } as cp.ExecFileOptionsWithBufferEncoding);

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: string) => { stdout += chunk; });
    proc.stderr?.on("data", (chunk: string) => { stderr += chunk; });
    proc.on("error", (err) => reject(new Error(`Docker error: ${err.message}`)));
    proc.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout || "(no output)");
      } else {
        const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
        resolve(`Exit code ${exitCode}\n${combined || "(no output)"}`);
      }
    });

    if (proc.stdin) {
      proc.stdin.write(code);
      proc.stdin.end();
    }
  });
}
