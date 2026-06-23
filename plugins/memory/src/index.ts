import type { PluginContext } from "@lmstudio/sdk";

import { buildConfigSchematics } from "./configSchematics.js";
import { createToolsProvider } from "./toolsProvider.js";
import { MemoryStore } from "./memoryStore.js";

export async function main(ctx: PluginContext) {
  const configSchematics = buildConfigSchematics();

  // The tools provider reads config. We'll use a global store since
  // it needs to persist across tool calls.
  const store = new MemoryStore("memories.json");
  await store.load();

  ctx
    .withConfigSchematics(configSchematics)
    .withToolsProvider(createToolsProvider(store));
}
