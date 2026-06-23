import * as fs from "node:fs/promises";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  value: string;
  created: string;
  updated: string;
  agentId?: string;  // NEW: scoped to agent
}

interface MemoryFile {
  version: 1;
  memories: Record<string, MemoryEntry>;
}

// ---------------------------------------------------------------------------
// Agent context helper
// ---------------------------------------------------------------------------

const AGENTS_FILE = path.join(
  process.env.HOME || "/home/laim",
  ".lmstudio", "agents", "active.json",
);

/** Read the active agent ID from the shared context file. */
export function readActiveAgent(): string | null {
  try {
    const raw = fsSync.readFileSync(AGENTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.id || null;
  } catch {
    return null;
  }
}

import * as fsSync from "node:fs";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class MemoryStore {
  private filePath: string;
  private data: MemoryFile;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.data = { version: 1, memories: {} };
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as MemoryFile;
      if (parsed.version === 1 && parsed.memories) {
        this.data = parsed;
      }
    } catch {
      this.data = { version: 1, memories: {} };
      await this.save();
    }
  }

  private async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  /** Get the active agent's namespace prefix, or empty string for global. */
  private agentPrefix(): string {
    const agent = readActiveAgent();
    return agent ? `${agent}::` : "";
  }

  private agentKey(key: string): string {
    return `${this.agentPrefix()}${key}`;
  }

  private stripPrefix(key: string): string {
    const prefix = this.agentPrefix();
    if (prefix && key.startsWith(prefix)) {
      return key.slice(prefix.length);
    }
    return key;
  }

  // ---- Operations ---------------------------------------------------------

  async remember(key: string, value: string): Promise<void> {
    const aKey = this.agentKey(key);
    const now = new Date().toISOString();
    const agentId = readActiveAgent() || undefined;

    if (this.data.memories[aKey]) {
      this.data.memories[aKey].value = value;
      this.data.memories[aKey].updated = now;
      if (agentId) this.data.memories[aKey].agentId = agentId;
    } else {
      this.data.memories[aKey] = {
        value, created: now, updated: now, agentId,
      };
    }
    await this.save();
  }

  async edit(key: string, value: string): Promise<boolean> {
    const aKey = this.agentKey(key);
    if (!this.data.memories[aKey]) return false;
    const now = new Date().toISOString();
    this.data.memories[aKey].value = value;
    this.data.memories[aKey].updated = now;
    await this.save();
    return true;
  }

  recall(key: string): MemoryEntry | undefined {
    return this.data.memories[this.agentKey(key)];
  }

  /** Search memory values for a substring (within current agent scope). */
  searchValues(query: string): { key: string; entry: MemoryEntry }[] {
    const prefix = this.agentPrefix();
    const lower = query.toLowerCase();
    const results: { key: string; entry: MemoryEntry }[] = [];

    for (const [fullKey, entry] of Object.entries(this.data.memories)) {
      // If scoped, only match this agent's keys
      if (prefix && !fullKey.startsWith(prefix)) continue;
      if (entry.value.toLowerCase().includes(lower)) {
        results.push({ key: this.stripPrefix(fullKey), entry });
      }
    }
    return results;
  }

  async forget(key: string): Promise<boolean> {
    const aKey = this.agentKey(key);
    const existed = aKey in this.data.memories;
    if (existed) {
      delete this.data.memories[aKey];
      await this.save();
    }
    return existed;
  }

  listKeys(filter?: string): string[] {
    const prefix = this.agentPrefix();
    const keys = Object.keys(this.data.memories)
      .filter((k) => !prefix || k.startsWith(prefix))
      .map((k) => this.stripPrefix(k));

    if (filter) {
      const lower = filter.toLowerCase();
      return keys.filter((k) => k.toLowerCase().includes(lower)).sort();
    }
    return keys.sort();
  }

  /** Stats: total and per-agent breakdown. */
  stats(): { total: number; agents: Record<string, number>; currentAgent: string | null } {
    const agents: Record<string, number> = {};
    for (const entry of Object.values(this.data.memories)) {
      const agent = entry.agentId || "__global__";
      agents[agent] = (agents[agent] || 0) + 1;
    }
    return {
      total: Object.keys(this.data.memories).length,
      agents,
      currentAgent: readActiveAgent(),
    };
  }

  count(): number {
    const prefix = this.agentPrefix();
    if (!prefix) return Object.keys(this.data.memories).length;
    return Object.keys(this.data.memories).filter((k) => k.startsWith(prefix)).length;
  }
}
