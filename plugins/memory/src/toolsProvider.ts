import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";

import { buildConfigSchematics } from "./configSchematics.js";
import { MemoryStore } from "./memoryStore.js";

const configSchematics = buildConfigSchematics();

export function createToolsProvider(store: MemoryStore): ToolsProvider {
  return async (_ctl) => {
    // ── remember ──────────────────────────────────────────────────────────
    const rememberTool = tool({
      name: "remember",
      description: [
        "Save a fact or piece of information to persistent memory.",
        "When an agent is active via agent-manager, memories are scoped to that agent.",
        "Use this for user preferences, project context, research notes, etc.",
      ].join(" "),
      parameters: {
        key: z.string().min(1).max(200).describe("A short, descriptive key for the memory"),
        value: z.string().min(1).max(10000).describe("The fact or information to store"),
      },
      async implementation({ key, value }) {
        await store.remember(key, value);
        const agent = store.stats().currentAgent;
        const scope = agent ? ` agent: "${agent}"` : " (global)";
        return `Remembered "${key}".${scope} Total: ${store.count()}`;
      },
    });

    // ── recall ────────────────────────────────────────────────────────────
    const recallTool = tool({
      name: "recall",
      description: "Retrieve a previously saved memory by its key.",
      parameters: {
        key: z.string().min(1).max(200).describe("The key of the memory to retrieve"),
      },
      async implementation({ key }) {
        const entry = store.recall(key);
        if (!entry) return `No memory found for key "${key}".`;
        return [
          `Key: ${key}`,
          `Value: ${entry.value}`,
          `Created: ${entry.created}`,
          `Updated: ${entry.updated}`,
          entry.agentId ? `Agent: ${entry.agentId}` : null,
        ].filter(Boolean).join("\n");
      },
    });

    // ── memory_edit ──────────────────────────────────────────────────────
    const editTool = tool({
      name: "memory_edit",
      description: "Update the value of an existing memory by its key.",
      parameters: {
        key: z.string().min(1).max(200).describe("The key of the memory to edit"),
        value: z.string().min(1).max(10000).describe("The new value"),
      },
      async implementation({ key, value }) {
        const ok = await store.edit(key, value);
        if (!ok) return `No memory found for key "${key}". Nothing to edit.`;
        return `Updated "${key}".`;
      },
    });

    // ── memory_search ────────────────────────────────────────────────────
    const searchTool = tool({
      name: "memory_search",
      description: "Search memory values for text. Returns all matching keys and their values within the current agent scope.",
      parameters: {
        query: z.string().min(1).max(200).describe("Text to search for in memory values"),
        maxResults: z.number().int().min(1).max(50).default(10).describe("Maximum results to return"),
      },
      async implementation({ query, maxResults }) {
        const results = store.searchValues(query);
        if (results.length === 0) return `No memories match "${query}".`;

        const lines: string[] = [];
        for (const { key, entry } of results.slice(0, maxResults)) {
          const excerpt = entry.value.length > 200
            ? entry.value.slice(0, 200) + "..."
            : entry.value;
          lines.push(`• ${key}: ${excerpt}`);
        }
        if (results.length > maxResults) {
          lines.push(`\n... and ${results.length - maxResults} more matches.`);
        }
        lines.push(`\nFound ${results.length} match(es) for "${query}".`);
        return lines.join("\n");
      },
    });

    // ── forget ────────────────────────────────────────────────────────────
    const forgetTool = tool({
      name: "forget",
      description: "Delete a previously saved memory by its key.",
      parameters: {
        key: z.string().min(1).max(200).describe("The key of the memory to delete"),
      },
      async implementation({ key }) {
        const existed = await store.forget(key);
        return existed
          ? `Forgot "${key}".`
          : `No memory found for key "${key}". Nothing to forget.`;
      },
    });

    // ── list_memories ────────────────────────────────────────────────────
    const listTool = tool({
      name: "list_memories",
      description: "List all memory keys, optionally filtered by a search term.",
      parameters: {
        filter: z.string().optional().describe("Optional search term to filter keys by"),
      },
      async implementation({ filter }) {
        const keys = store.listKeys(filter);
        if (keys.length === 0) {
          return filter
            ? `No memories match "${filter}".`
            : "No memories stored yet.";
        }
        const lines = keys.map((k, i) => `${i + 1}. ${k}`);
        lines.push(`\nTotal: ${keys.length} memory(s)`);
        return lines.join("\n");
      },
    });

    // ── memory_stats ─────────────────────────────────────────────────────
    const statsTool = tool({
      name: "memory_stats",
      description: "Get memory usage statistics: total count, per-agent breakdown, and current agent scope.",
      parameters: {},
      async implementation() {
        const s = store.stats();
        const lines: string[] = [
          `📊 Memory Statistics`,
          `   Total entries: ${s.total}`,
        ];
        for (const [agent, count] of Object.entries(s.agents)) {
          const marker = agent === s.currentAgent ? " ← active" : "";
          lines.push(`   ${agent === "__global__" ? "🌐 Global" : `🤖 ${agent}`}: ${count}${marker}`);
        }
        if (s.currentAgent) {
          lines.push(`\n   Scoped to agent: ${s.currentAgent}`);
        } else {
          lines.push("\n   No agent active — operating in global scope.");
        }
        return lines.join("\n");
      },
    });

    return [rememberTool, recallTool, editTool, searchTool, forgetTool, listTool, statsTool];
  };
}
