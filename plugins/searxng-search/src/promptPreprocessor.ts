import type { PromptPreprocessor } from "@lmstudio/sdk";
import { buildConfigSchematics } from "./configSchematics.js";

const configSchematics = buildConfigSchematics();
const SEARCH_GUIDELINES = [
  `<web-search-guidance added-by="lmstudio-searxng-search">`,
  `Use web_search before answering questions that depend on current or external facts.`,
  `If results are weak, search again or use multi_hop.`,
  `Compare relevant results and cite only URLs returned by the tool.`,
  `Never claim to have searched when no successful tool result was returned.`,
  `</web-search-guidance>`,
].join("\n");

export const promptPreprocessor: PromptPreprocessor = async (ctl, userMessage) => {
  const config = ctl.getPluginConfig(configSchematics);
  if (!config.get("injectPrompt")) return userMessage;
  return `${SEARCH_GUIDELINES}\n\n${userMessage.getText()}`;
};
