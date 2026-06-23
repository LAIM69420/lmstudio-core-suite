import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field("timeoutMs", "numeric", { min: 1000, max: 300000, int: true }, 30000)
    .field("maxOutputChars", "numeric", { min: 100, max: 100000, int: true }, 10000)
    .field("allowedLanguages", "select", {
      options: [
        { displayName: "All (Python, JS, Rust, Shell)", value: "all" },
        { displayName: "Python only", value: "python" },
        { displayName: "JavaScript only", value: "javascript" },
        { displayName: "Rust only", value: "rust" },
        { displayName: "Shell only", value: "shell" },
      ],
    }, "all")
    .field("useDocker", "boolean", {}, true)
    .field("dockerMemoryLimit", "string", {}, "512m")
    .field("dockerCpuLimit", "numeric", { min: 0.1, max: 16 }, 1.0)
    .build();
}
