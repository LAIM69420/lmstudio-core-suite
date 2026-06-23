import type { PluginContext } from "@lmstudio/sdk";

import { buildConfigSchematics } from "./configSchematics.js";
import { toolsProvider } from "./toolsProvider.js";
import { promptPreprocessor } from "./promptPreprocessor.js";

// ---------------------------------------------------------------------------
// Plugin entry point
//
// LM Studio's dev wrapper calls this function with a PluginContext after
// setting up authentication. We register all hooks via the context.
// ---------------------------------------------------------------------------

export async function main(ctx: PluginContext) {
  const configSchematics = buildConfigSchematics();

  ctx
    .withConfigSchematics(configSchematics)
    .withToolsProvider(toolsProvider)
    .withPromptPreprocessor(promptPreprocessor);
}
