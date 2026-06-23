import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import * as cp from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

import { buildConfigSchematics } from "./configSchematics.js";

const configSchematics = buildConfigSchematics();

// ---------------------------------------------------------------------------
// Risk level definitions
// ---------------------------------------------------------------------------

type RiskLevel = "safe" | "info" | "moderate" | "risky";

const COMMAND_RISK: Record<string, RiskLevel> = {
  ls: "safe", pwd: "safe", whoami: "safe", date: "safe",
  uptime: "safe", uname: "safe", echo: "safe", df: "safe", du: "safe",
  free: "info", ps: "info", env: "info", which: "info",
  git: "moderate", find: "moderate", grep: "moderate", cat: "moderate",
  head: "moderate", tail: "moderate", wc: "moderate", sort: "moderate",
  chmod: "risky", chown: "risky", kill: "risky", rm: "risky",
  mv: "risky", cp: "risky", mkdir: "risky", touch: "risky",
  curl: "risky", wget: "risky",
};

const RISK_ORDER: RiskLevel[] = ["safe", "info", "moderate", "risky"];

function riskIndex(level: RiskLevel): number {
  return RISK_ORDER.indexOf(level);
}

function commandRiskLevel(cmd: string): RiskLevel {
  return COMMAND_RISK[cmd] || "risky"; // unknown commands default to risky
}

// ---------------------------------------------------------------------------
// Agent context
// ---------------------------------------------------------------------------

const AGENTS_FILE = path.join(
  process.env.HOME || "/home/laim",
  ".lmstudio", "agents", "active.json",
);

function readActiveAgent(): { id?: string; allowedCommands?: string[]; maxRiskLevel?: string } | null {
  try {
    const raw = fs.readFileSync(AGENTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Confirmation token store
// ---------------------------------------------------------------------------

const PENDING_FILE = path.join(
  process.env.HOME || "/home/laim",
  ".lmstudio", "audit", "pending.json",
);

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function storePending(token: string, command: string, args: string[]): void {
  const dir = path.dirname(PENDING_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const pending: Record<string, any> = {};
  try { Object.assign(pending, JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"))); } catch {}
  pending[token] = { command, args, timestamp: Date.now() };
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2), "utf-8");
}

export function checkConfirmation(token: string): boolean {
  try {
    const pending: Record<string, any> = JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"));
    const entry = pending[token];
    if (!entry) return false;
    // Token valid for 5 minutes
    if (Date.now() - entry.timestamp > 300_000) {
      delete pending[token];
      fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2), "utf-8");
      return false;
    }
    // Check if confirmed via permission-manager
    if (entry.confirmed === true) {
      delete pending[token];
      fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2), "utf-8");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tools provider
// ---------------------------------------------------------------------------

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);

  const allowedStr: string = config.get("allowedCommands");
  const allowedPathsStr: string = config.get("allowedPaths");
  const timeoutMs: number = config.get("timeoutMs");
  const maxRiskLevel: RiskLevel = config.get("maxRiskLevel") as RiskLevel;

  // Base allowed commands from config
  const baseAllowed = new Set(
    allowedStr.split(",").map((s) => s.trim()).filter(Boolean),
  );

  // Merge per-agent allow-list
  const agent = readActiveAgent();
  const allowedCommands = new Set(baseAllowed);
  if (agent?.allowedCommands && Array.isArray(agent.allowedCommands)) {
    agent.allowedCommands.forEach((c) => allowedCommands.add(c));
  }
  const agentMaxRisk = (agent?.maxRiskLevel as RiskLevel) || maxRiskLevel;

  const allowedDirs = allowedPathsStr
    .split(",")
    .map((s) => path.resolve(s.trim()))
    .filter(Boolean);

  const cmdTool = tool({
    name: "run_command",
    description: [
      "Run a whitelisted system command in a restricted directory.",
      `Allowed: ${[...allowedCommands].join(", ")}`,
      `Max risk level: ${agentMaxRisk}. Commands are categorized: safe, info, moderate, risky.`,
      "Use this to inspect project structure, check git status, or get system info.",
      "For risky commands, set requireConfirmation=true — you'll get a token to approve via confirm_action.",
    ].join(" "),
    parameters: {
      command: z.string().min(1).describe("The command to run"),
      args: z.array(z.string()).optional().describe("Command arguments"),
      workDir: z.string().optional().describe("Working directory"),
      requireConfirmation: z
        .boolean()
        .optional()
        .default(false)
        .describe("Set true for risky ops — returns a confirmation token"),
      confirmationToken: z
        .string()
        .optional()
        .describe("Token from a previous requireConfirmation=true call to authorize execution"),
    },
    async implementation({ command, args, workDir, requireConfirmation, confirmationToken }) {
      // --- Security: command whitelist ------------------------------------
      if (!allowedCommands.has(command)) {
        return [
          `Command "${command}" is not in the allowed list.`,
          `Allowed: ${[...allowedCommands].join(", ")}`,
        ].join("\n");
      }

      // --- Risk check ----------------------------------------------------
      const risk = commandRiskLevel(command);
      const agentMaxIdx = riskIndex(agentMaxRisk);
      const cmdRiskIdx = riskIndex(risk);

      if (cmdRiskIdx > agentMaxIdx) {
        return [
          `Command "${command}" is risk level "${risk}" which exceeds max allowed "${agentMaxRisk}".`,
          `Use a lower-risk command or increase maxRiskLevel in settings.`,
        ].join("\n");
      }

      // --- Confirmation flow for risky or moderate commands ---------------
      if (cmdRiskIdx >= riskIndex("moderate") && requireConfirmation && !confirmationToken) {
        const token = generateToken();
        storePending(token, command, args ?? []);
        return [
          `⚠️  Confirmation required for "${command}" (risk: ${risk}).`,
          `Token: ${token}`,
          `Call permission-manager's confirm_action(token="${token}", approve=true) to authorize,`,
          `then call run_command again with confirmationToken="${token}".`,
        ].join("\n");
      }

      if (confirmationToken) {
        const valid = checkConfirmation(confirmationToken);
        if (!valid) {
          return `Invalid or expired confirmation token: "${confirmationToken}". Request a fresh one with requireConfirmation=true.`;
        }
      }

      // --- Resolve working directory -------------------------------------
      let cwd = process.cwd();
      if (workDir) {
        const resolved = path.resolve(workDir);
        const inBounds =
          allowedDirs.length === 0 ||
          allowedDirs.some((d) => resolved.startsWith(d + path.sep) || resolved === d);
        if (!inBounds) {
          return [
            `Directory not allowed: ${resolved}`,
            `Allowed paths: ${allowedDirs.join(", ") || "(current directory)"}`,
          ].join("\n");
        }
        cwd = resolved;
      }

      // --- Run -----------------------------------------------------------
      return new Promise((resolve) => {
        const proc = cp.execFile(
          command,
          args ?? [],
          { cwd, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) {
              const code =
                err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
                  ? "(output too large)"
                  : `exit ${err.code ?? "?"}`;
              const msg = [stdout, stderr].filter(Boolean).join("\n").trim();
              resolve(msg ? `(${code})\n${msg}` : `(exit code: ${err.code ?? "unknown"})`);
              return;
            }
            resolve(stdout.trim() || "(empty output)");
          },
        );
      });
    },
  });

  return [cmdTool];
};
