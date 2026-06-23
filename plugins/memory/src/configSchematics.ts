import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field(
      "memoryFilePath",
      "string",
      {},
      "./memories.json",
    )
    .build();
}
