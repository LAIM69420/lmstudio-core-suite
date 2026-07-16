export interface SearchUrlOptions {
  query: string;
  safeSearch: string;
  categories?: string;
  language?: string;
  extra?: Record<string, string>;
}

export function buildSearchUrl(baseUrl: string, options: SearchUrlOptions): string {
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new Error(`Invalid SearXNG URL: ${baseUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SearXNG URL must use HTTP or HTTPS.");
  }

  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/search") ? path : `${path}/search`;
  url.search = "";
  url.hash = "";
  url.searchParams.set("q", options.query);
  url.searchParams.set("format", "json");
  url.searchParams.set("safesearch", options.safeSearch);
  if (options.categories?.trim()) url.searchParams.set("categories", options.categories.trim());
  if (options.language?.trim() && options.language !== "auto") {
    url.searchParams.set("language", options.language.trim());
  }
  for (const [key, value] of Object.entries(options.extra ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function isSafePageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
    const match = host.match(/^172\.(\d+)\./);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return false;
    if (/^169\.254\./.test(host) || host === "0.0.0.0") return false;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
    return true;
  } catch {
    return false;
  }
}
