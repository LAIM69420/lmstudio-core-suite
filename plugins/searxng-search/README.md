# LM Studio SearXNG Search

A native LM Studio plugin for privacy-first live web search through a self-hosted [SearXNG](https://docs.searxng.org/) instance.

## Capabilities

- Standard SearXNG metasearch with site, category, and best-effort date filters
- Optional multi-hop refinement and result deduplication
- Optional top-result page fetching with protocol, local-address, content-type, and size guards
- Configurable SafeSearch, language, categories, timeouts, and result limits
- Compact prompt guidance for proactive searches and real URL citations

## Requirements

- An LM Studio release with plugin support
- Node.js 22 or newer for source installation
- SearXNG with JSON output enabled

The plugin targets `@lmstudio/sdk` 1.5.0; that is the SDK version, not the desktop app version.

Enable JSON in SearXNG's `settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

Verify it with:

```bash
curl "http://localhost:8080/search?q=lm+studio&format=json"
```

## Install from the core suite

```bash
git clone https://github.com/LAIM69420/lmstudio-core-suite.git
cd lmstudio-core-suite/plugins/searxng-search
npm ci
npm run install:plugin
```

## Configuration

| Field | Default | Purpose |
| --- | --- | --- |
| `searxngUrl` | `http://localhost:8080` | SearXNG base URL, including path-based installations |
| `maxResults` | `5` | Results returned per search |
| `safeSearch` | `Off` | Off, Moderate, or Strict |
| `categories` | empty | Default comma-separated SearXNG categories |
| `language` | `auto` | SearXNG language code |
| `timeoutMs` | `15000` | Search request timeout |
| `injectPrompt` | `true` | Add compact search and citation guidance |
| `summarizeEnabled` | `true` | Permit guarded page fetching when requested |
| `summarizeMaxChars` | `5000` | Maximum combined content returned to the model |
| `pageFetchMaxBytes` | `1000000` | Maximum accepted page response size |

## Security scope

The search request is sent only to the configured SearXNG instance. Optional page fetching rejects non-HTTP URLs, localhost, common private address ranges, oversized responses, and non-text content. DNS-level rebinding protection is not currently implemented, so leave summarization disabled when the SearXNG instance or its result sources are untrusted.

## Development

```bash
npm ci
npm test
npm run dev
```

## License

[MIT](LICENSE)
