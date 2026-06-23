import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field(
      "allowedDirectories",
      "string",
      {},
      "",
    )
    .field(
      "maxFileSize",
      "numeric",
      { min: 1, max: 102400, int: true },
      1024,
    )
    .build();
}
