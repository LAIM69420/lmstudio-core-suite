# lmstudio-core-suite

LM Studio plugins for the basics an agent needs to be useful: web search, document reading, persistent memory, sandboxed code execution, and whitelisted system commands.

Five plugins, one repo, shared build setup. Each plugin is self-contained — install only the ones you want.

## Plugins

| Plugin | Tools | Requires | Notes |
|---|---|---|---|
| [`searxng-search`](plugins/searxng-search) | `web_search` | SearXNG on `127.0.0.1:8080` | Self-hosted metasearch; no API key |
| [`read-document`](plugins/read-document) | `read_file`, `file_metadata` | — | PDF, CSV, JSON, Markdown, code, plain text |
| [`memory`](plugins/memory) | `remember`, `recall`, `memory_search`, `memory_edit`, `list_memories`, `forget`, `memory_stats` | — | SQLite-backed; survives restarts |
| [`execute-code`](plugins/execute-code) | `execute_code` | Docker | Runs code in a Docker sandbox with timeout and output limits |
| [`system-command`](plugins/system-command) | `run_command`, `safe` | — | Fixed allowlist (`ls`, `git`, `date`, `du`, `df`, `pwd`), restricted working directory |

## Install

Each plugin installs independently:

```bash
cd plugins/<name>
npm install    # runs `lms dev --install --yes`
npm run build
```

`npm install` triggers the `install` script, which hands the plugin to LM Studio's dev installer. Restart or refresh LM Studio afterwards.

## Requirements

- LM Studio with the local API server enabled
- Node 18+ for building
- `searxng-search`: a reachable SearXNG instance (configurable base URL)
- `execute-code`: Docker daemon accessible to the plugin process

## Privileged surface

`execute-code` and `system-command` can run code and commands. Neither is a security boundary by itself.

- `execute-code` depends on Docker isolation being real: if the daemon socket is mounted or the container runs `--privileged`, the sandbox is theatre.
- `system-command` is allowlist-only and directory-restricted, but the allowlist includes `git`, which can touch any repository the process user can reach.

If you run [`lmstudio-permission-manager`](https://github.com/LAIM69420/lmstudio-permission-manager), route these two through it. See the root `docs/` for the plugin README template.

## Conventions

- One tool namespace per plugin; tool names are prefixed by domain (`web_`, `memory_`, `file_`, `run_`).
- Config via `createConfigSchematics`; secrets use `{ isProtected: true }`.
- `withToolsProvider(async (ctl) => ...)` — `ctx.getPluginConfig` is deprecated in favour of `ctl.getPluginConfig`.

## Verification

```bash
node scripts/smoke.mjs            # check every plugin
node scripts/smoke.mjs --update   # rewrite the tool baseline after an intentional change
```

The harness validates each manifest, requires a substantive description, checks that declared icons exist, extracts every `tool({ name })` from source, and fails if the built output is stale or a tool appears, disappears, or is renamed relative to `scripts/expected-tools.json`.

## Status

| Item | State |
|---|---|
| Tests | none — no automated coverage in any plugin |
| Last verified | built against `@lmstudio/sdk` 1.5.0 (2026-06-23); running app is 0.4.28, not re-verified |
| Known gaps | `execute-code` sandbox strength unverified; no per-plugin READMEs yet |

## License

MIT
