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
| SearXNG | Reachable instance, default `http://localhost:8080`, with JSON output enabled in `settings.yml` |

## Configuration

`searxngUrl`, `maxResults`, `safeSearch`, `categories`, `injectPrompt`, `summarizeEnabled`, `summarizeMaxChars`.

Configured in LM Studio under Integrations → searxng-search; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Sends your queries to the configured instance and returns whatever it finds. With `injectPrompt` enabled, results are inserted into every matching prompt, which consumes context whether or not you asked for a search. SearXNG aggregates other engines, so queries leave your machine even though the endpoint is local.

## Failure modes

| Symptom | Cause |
|---|---|
| Empty results | SearXNG returns JSON only if the `json` format is enabled in its settings |
| Connection refused | Wrong port — the container may publish 8080 while the app expects another |

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
