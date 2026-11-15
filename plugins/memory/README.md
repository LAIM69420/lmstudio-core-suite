# memory

Persistent memory across conversations, backed by a JSON file on disk. The model can store facts, search them, edit them, and forget them.

| | |
|---|---|
| Type | tools |
| Tools | 7 |
| Requires network | no |
| Requires external service | no |
| Destructive | no |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `forget` | Delete a memory by id |
| `list_memories` | List stored memories, newest first |
| `memory_edit` | Update an existing memory in place |
| `memory_search` | Full-text search across stored memories |
| `memory_stats` | Counts and storage size |
| `recall` | Fetch a fact by key or recent entries |
| `remember` | Store a fact with optional tags |

## Requirements

| Requirement | Detail |
|---|---|
| Storage | JSON file at `memoryFilePath`, default `./memories.json` relative to the plugin host |

## Configuration

`memoryFilePath` — where the JSON store lives. Point it outside the app directory if you want it backed up.

Configured in LM Studio under Integrations → memory; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Everything you tell the model to remember is written in plaintext to that file. There is no encryption, no redaction, and no expiry. Do not store credentials in memory; anything written persists until explicitly forgotten.

## Failure modes

| Symptom | Cause |
|---|---|
| Memories disappeared | `memoryFilePath` resolved somewhere transient, or the store was replaced |
| Search misses an entry | Search is substring-based, not semantic |

## Example prompts

- "Remember that I run LM Studio on port 1234."
- "What do you remember about my local setup?"

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
