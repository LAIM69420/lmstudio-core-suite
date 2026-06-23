import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";

import { buildConfigSchematics } from "./configSchematics.js";
import { getAllowedLanguages, runCode, setDockerConfig } from "./codeRunner.js";

const configSchematics = buildConfigSchematics();

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);
  const timeoutMs: number = config.get("timeoutMs");
  const maxOutputChars: number = config.get("maxOutputChars");
  const allowedConfig: string = config.get("allowedLanguages");
  const useDocker: boolean = config.get("useDocker");
  const dockerMemoryLimit: string = config.get("dockerMemoryLimit");
  const dockerCpuLimit: number = config.get("dockerCpuLimit");

  const allowedLangs = getAllowedLanguages(allowedConfig);

  // Configure Docker mode
  setDockerConfig({ enabled: useDocker, memoryLimit: dockerMemoryLimit, cpuLimit: dockerCpuLimit });

  // Get docker availability info
  let dockerHint = "";
  if (useDocker) {
    try {
      const { execSync } = await import("node:child_process");
      execSync("docker info", { timeout: 3000, stdio: "ignore" });
      dockerHint = " | Docker sandbox active";
    } catch {
      dockerHint = " | ⚠️ Docker not available — falling back to subprocess";
      setDockerConfig({ enabled: false });
    }
  } else {
    dockerHint = " | Subprocess mode (no sandbox)";
  }

  const execTool = tool({
    name: "execute_code",
    description: [
      `Execute code in a sandboxed environment. Supported: ${allowedLangs.join(", ")}.`,
      `Timeout: ${(timeoutMs / 1000).toFixed(0)}s. Output limit: ${maxOutputChars} chars.${dockerHint}`,
      "Use for calculations, data processing, scripting, and testing.",
    ].join(" "),
    parameters: {
      language: z
        .enum(["python", "javascript", "rust", "shell"] as const)
        .describe("Programming language to run"),
      code: z.string().min(1).max(50000).describe("The source code to execute"),
    },
    async implementation({ language, code }) {
      if (!allowedLangs.includes(language)) {
        return [
          `Language "${language}" is not allowed.`,
          `Allowed: ${allowedLangs.join(", ") || "(none)"}`,
          `Change this in plugin settings.`,
        ].join("\n");
      }

      return await runCode(language, code, timeoutMs, maxOutputChars);
    },
  });

  return [execTool];
};
