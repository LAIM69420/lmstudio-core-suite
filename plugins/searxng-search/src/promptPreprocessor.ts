import type { PromptPreprocessor } from "@lmstudio/sdk";

import { buildConfigSchematics } from "./configSchematics.js";

const configSchematics = buildConfigSchematics();

/**
 * GPT / Perplexity-style web search guidelines prepended to the user's message
 * when the injectPrompt config is enabled.
 */
const SEARCH_GUIDELINES = [
  `[SYSTEM] You have access to a web search tool called \`web_search\`. Use it proactively whenever you need current, factual, or detailed information.`,
  ``,
  `Search guidelines:`,
  `- When a question requires specific facts, data, or recent events, use \`web_search\` before composing your answer.`,
  `- If initial results are sparse or unclear, rephrase the query and search again — multiple searches often yield better coverage.`,
  `- Synthesize information across multiple search results. Note any contradictions or differing viewpoints.`,
  `- Cite sources by including the relevant URL(s) inline or at the end of your response.`,
  `- Do not fabricate citations or claim you have searched when you have not. Only cite results actually returned by \`web_search\`.`,
  `- For time-sensitive topics (news, prices, weather, tech releases), always search — your training data may be outdated.`,
  `[/SYSTEM]`,
].join("\n");

// ---------------------------------------------------------------------------
// Prompt preprocessor
//
// The prompt preprocessor runs on every user message. If injectPrompt is
// enabled, we prepend the search guidelines to the user's message text.
// The SDK will use the returned string as the user message content.
// ---------------------------------------------------------------------------

export const promptPreprocessor: PromptPreprocessor = async (ctl, userMessage) => {
  const config = ctl.getPluginConfig(configSchematics);
  const injectPrompt: boolean = config.get("injectPrompt");

  if (!injectPrompt) {
    return userMessage;
  }

  // Prepend the search guidelines to the user's message text.
  const userText = userMessage.getText();
  return `${SEARCH_GUIDELINES}\n\n${userText}`;
};
