import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field("searxngUrl", "string", {}, "http://localhost:8080")
    .field(
      "maxResults",
      "numeric",
      { min: 1, max: 20, int: true },
      5,
    )
    .field("safeSearch", "select", {
      options: [
        { displayName: "Off", value: "0" },
        { displayName: "Moderate", value: "1" },
        { displayName: "Strict", value: "2" },
      ],
    }, "0")
    .field("categories", "string", {}, "")
    .field("injectPrompt", "boolean", {}, true)
    .field("summarizeEnabled", "boolean", {}, true)
    .field("summarizeMaxChars", "numeric", { min: 500, max: 50000, int: true }, 5000)
    .build();
}
