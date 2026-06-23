import { z } from "zod";
import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { buildConfigSchematics } from "./configSchematics.js";

const configSchematics = buildConfigSchematics();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SearxngResult {
  title?: string;
  url?: string;
  content?: string;
}
interface SearxngResponse {
  results?: SearxngResult[];
}

// ---------------------------------------------------------------------------
// Tools provider
// ---------------------------------------------------------------------------

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);

  const searxngUrl: string = config.get("searxngUrl");
  const maxResults: number = config.get("maxResults");
  const safeSearch: string = config.get("safeSearch");
  const categories: string = config.get("categories");
  const summarizeEnabled: boolean = config.get("summarizeEnabled");
  const summarizeMaxChars: number = config.get("summarizeMaxChars");

  // ── Internal: raw search ───────────────────────────────────────────────
  async function doSearch(params: Record<string, string>): Promise<SearxngResult[]> {
    const queryParams = new URLSearchParams({
      format: "json",
      safesearch: safeSearch,
      ...params,
    });
    if (categories.trim().length > 0) {
      queryParams.set("categories", categories.trim());
    }
    const url = `${searxngUrl.replace(/\/+$/, "")}/search?${queryParams.toString()}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const data = (await response.json()) as SearxngResponse;
    return (data.results ?? []).slice(0, maxResults);
  }

  function formatResults(results: SearxngResult[]): string {
    if (results.length === 0) return "No search results found.";
    return results
      .map((r) => {
        const parts: string[] = [];
        if (r.title) parts.push(`Title: ${r.title}`);
        if (r.url) parts.push(`URL: ${r.url}`);
        if (r.content) parts.push(`Snippet: ${r.content}`);
        return parts.join("\n");
      })
      .join("\n---\n");
  }

  // ── Tool: web_search ───────────────────────────────────────────────────
  const searchTool = tool({
    name: "web_search",
    description: [
      "Perform a web search using SearXNG (privacy-respecting metasearch).",
      "Supports advanced filters: date range, domain restriction, result type.",
      "Set summarize=true for an AI-compacted summary across top results.",
      "Set multi_hop=true for an automatic refinement loop.",
    ].join(" "),
    parameters: {
      query: z.string().min(1).describe("The search query string"),

      // Advanced filters
      date_from: z.string().optional().describe("Earliest date (ISO 8601, e.g. 2025-01-01)"),
      date_to: z.string().optional().describe("Latest date (ISO 8601, e.g. 2025-12-31)"),
      site: z.string().optional().describe("Restrict results to a specific domain (e.g. arxiv.org)"),
      result_type: z
        .enum(["general", "news", "files", "images", "videos", "it", "science"])
        .optional()
        .describe("Category filter for results"),

      // Smart modes
      summarize: z
        .boolean()
        .optional()
        .default(false)
        .describe("When true, fetches full pages of top results and returns a compact summary"),
      multi_hop: z
        .boolean()
        .optional()
        .default(false)
        .describe("When true, does an initial search, analyzes results for refinement terms, re-searches, and merges findings"),
    },
    async implementation({ query, date_from, date_to, site, result_type, summarize, multi_hop }) {
      // --- Build base params ------------------------------------------------
      const params: Record<string, string> = { q: query };
      if (date_from) params["time_range_from"] = date_from;
      if (date_to) params["time_range_to"] = date_to;
      if (site) params["q"] = `site:${site} ${query}`;
      if (result_type) params["categories"] = result_type;

      // --- Multi-hop: search → analyze → refine → merge ---------------------
      if (multi_hop) {
        try {
          const firstResults = await doSearch(params);
          if (firstResults.length === 0) return "No results for initial search.";

          // Analyze results for refinement terms
          const titles = firstResults.map((r) => r.title).filter(Boolean).join(" ");
          const snippets = firstResults.map((r) => r.content).filter(Boolean).join(" ");
          const rawText = `${titles} ${snippets}`;

          // Extract likely refinement terms (capitalized phrases, numbers, key terms)
          const refinementPattern = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)|(\b\d{4}\b)|(\b\w{6,}\b)/g;
          const matches = [...rawText.matchAll(refinementPattern)];
          const termFreq = new Map<string, number>();
          for (const m of matches) {
            const term = m[0].toLowerCase();
            if (term.length > 3 && !query.toLowerCase().includes(term)) {
              termFreq.set(term, (termFreq.get(term) || 0) + 1);
            }
          }
          const refinements = [...termFreq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([t]) => t);

          let secondQuery = query;
          if (refinements.length > 0) {
            secondQuery = `${query} ${refinements.join(" ")}`;
          }

          params["q"] = secondQuery;
          const secondResults = await doSearch(params);

          // Merge: interleave results, dedup by URL
          const seen = new Set<string>();
          const merged: SearxngResult[] = [];
          const all = [...firstResults, ...secondResults];
          for (const r of all) {
            const key = r.url || r.title || "";
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(r);
            }
          }

          const formatted = merged.slice(0, maxResults);
          let output = formatResults(formatted);
          if (refinements.length > 0) {
            output += `\n\n[Multi-hop: refined with "${refinements.join(", ")}"]`;
          }
          return output;
        } catch (err: any) {
          return `Multi-hop search error: ${err.message || err}`;
        }
      }

      // --- Standard search (with optional summarization) --------------------
      try {
        const results = await doSearch(params);

        if (summarize && summarizeEnabled && results.length > 0) {
          // Fetch full content of top results for summarization
          let fullText = "";
          for (const r of results.slice(0, 3)) {
            if (r.url) {
              try {
                const pageResp = await fetch(r.url, { signal: AbortSignal.timeout(5000) });
                if (pageResp.ok) {
                  const html = await pageResp.text();
                  // Strip HTML tags for rough text extraction
                  const text = html
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 3000);
                  if (text.length > 100) {
                    fullText += `\n--- ${r.title} ---\n${text}\n`;
                  }
                }
              } catch {
                // Skip un-fetchable URLs
              }
            }
          }

          if (fullText.length > 0) {
            const truncated = fullText.slice(0, summarizeMaxChars);
            const rawResults = formatResults(results);
            return [
              `## Search Results\n${rawResults}`,
              ``,
              `## Fetched Content (truncated to ${truncated.length} chars)\n${truncated}`,
            ].join("\n");
          }
        }

        return formatResults(results);
      } catch (err: any) {
        const msg = err.message || String(err);
        if (msg.includes("aborted") || msg.includes("timeout")) {
          return `Search timed out. Is your SearXNG instance running at ${searxngUrl}?`;
        }
        if (msg.includes("fetch") || msg.includes("connect") || msg.includes("ECONNREFUSED")) {
          return `Network error: ${msg}. Check that SearXNG is reachable.`;
        }
        return `Search error: ${msg}`;
      }
    },
  });

  return [searchTool];
};
