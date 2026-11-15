# searxng-search

Web search through a self-hosted SearXNG instance, optionally injecting results into the prompt and summarising them.

| | |
|---|---|
| Type | tools |
| Tools | 1 |
| Requires network | no |
| Requires external service | yes |
| Destructive | no |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `web_search` | Search SearXNG and return titles, URLs, and snippets |

## Requirements

| Requirement | Detail |
|---|---|
| SearXNG | Reachable instance, default `http://localhost:8080` |
| JSON format | `search.formats` in SearXNG's `settings.yml` must include `json`, or every call fails with a clear parse error |
| Healthy engines | SearXNG returns 200 with zero results when its engines are blocked. See *Engine health* below |

## Configuration

`searxngUrl`, `maxResults`, `safeSearch`, `categories`, `injectPrompt`, `summarizeEnabled`, `summarizeMaxChars`.

Configured in LM Studio under Integrations → searxng-search; field definitions live in `src/configSchematics.ts`.

## Engine health

This plugin can only report what SearXNG finds. A 200 response with an empty `results` array almost always means the upstream engines refused — CAPTCHA, HTTP 403, rate limiting — not a plugin fault.

When that happens the tool now returns the engine failure list, for example:

```
No search results found.
These engines failed on this request (3):
  - brave: Suspended: too many requests
  - google: access denied
  - yandex: timeout
```

Fix it in SearXNG, not here:

- Keep the image current. A 2026.5.16 image had four of five engines failing; 2026.11.15 restored them.
- Check `/config` for which general engines are actually enabled. Recent versions enable only `duckduckgo`, `google cse`, and `brave` by default.
- SearXNG suspends a failing engine for a while, so a single retry often succeeds.

Requests time out after 30 seconds, because a cold SearXNG query fans out to every enabled engine and returns when the slowest finishes.

## Privileged surface

Sends your queries to the configured instance and returns whatever it finds. With `injectPrompt` enabled, results are inserted into every matching prompt, which consumes context whether or not you asked for a search. SearXNG aggregates other engines, so queries leave your machine even though the endpoint is local.

## Failure modes

| Symptom | Cause |
|---|---|
| "SearXNG returned HTML instead of JSON" | `json` missing from `search.formats` |
| "No search results found" with an engine list | Engines blocked upstream; see *Engine health* |
| "No results ... no engine errors" | Query too narrow, or all engines returned nothing |
| Timeout after 30s | An enabled engine hangs; drop it or lower `search.request_timeout` |
| Connection refused | Wrong `searxngUrl`, or the container is not running |

## Example prompts

- "Search for the current llama.cpp release notes."
- "Find recent discussion of Vulkan performance on RDNA2."

## Development

```bash
npm install    # also runs `lms dev --install`
npm run build  # tsc
node scripts/smoke.mjs   # from the suite root
```

## Status

| Item | State |
|---|---|
| Compiles | yes — verified with `tsc --noEmit` against the current toolchain |
| Tests | smoke harness: manifest validation + tool inventory |
| Verified against | LM Studio 0.4.28 |
| Known gaps | no behavioural tests; docs written from source review |

## License

MIT
