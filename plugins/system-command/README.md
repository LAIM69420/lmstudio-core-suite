# system-command

Runs a fixed allowlist of read-only shell commands inside a restricted directory tree.

| | |
|---|---|
| Type | tools |
| Tools | 1 |
| Requires network | no |
| Requires external service | no |
| Destructive | yes |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `run_command` | Execute one allowlisted command and return its output |

## Requirements

| Requirement | Detail |
|---|---|
| Shell | Host shell (`/bin/sh`) |

## Configuration

`allowedCommands` (default `ls,git,date,du,df,pwd,whoami,uptime,uname,echo`), `allowedPaths` (default `.`), `timeoutMs`, `maxRiskLevel`.

Configured in LM Studio under Integrations → system-command; field definitions live in `src/configSchematics.ts`.

## Privileged surface

The allowlist is the only control. `git` is on it by default and can read any repository the host user can reach, including remotes and history; it can also write if a subcommand mutates state. `allowedPaths` confines the working directory, not the arguments you pass. Command strings are built by the plugin, but treat the allowlist as advisory rather than a security boundary.

## Failure modes

| Symptom | Cause |
|---|---|
| Command not allowed | Not in `allowedCommands`, or above `maxRiskLevel` |
| Path rejected | Working directory outside `allowedPaths` |

## Example prompts

- "List the files in ~/Projects."
- "How much disk is free?"

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
