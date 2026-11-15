# execute-code

Runs short programs and shell snippets and returns their output. Python, JavaScript, PHP, Ruby, or bash, either in a Docker container or a plain subprocess.

| | |
|---|---|
| Type | tools |
| Tools | 1 |
| Requires network | no |
| Requires external service | yes |
| Destructive | yes |
| Version | 1.0.1 |

## Tools

| Tool | What it does |
|---|---|
| `execute_code` | Run a code snippet in the selected language and return stdout/stderr |

## Requirements

| Requirement | Detail |
|---|---|
| Docker (optional) | Daemon reachable from the plugin process when `useDocker` is on |
| Languages | Only runtimes present on the host or in the container image |

## Configuration

`timeoutMs` (wall clock, 1s–300s), `maxOutputChars`, `useDocker`, `dockerMemoryLimit`, `dockerCpuLimit`, `allowedLanguages`.

Configured in LM Studio under Integrations → execute-code; field definitions live in `src/configSchematics.ts`.

## Privileged surface

**This runs arbitrary code.** Docker mode is a container, not a guaranteed sandbox: if the daemon socket is mounted, if the container runs privileged, or if the image has the host filesystem bind-mounted, isolation is nominal. Subprocess mode is not a sandbox at all — it runs as the plugin host user with that user's full access. There is no allowlist of operations, only a language list and a timeout.

## Failure modes

| Symptom | Cause |
|---|---|
| Exit code N with no output | Program failed before producing stdout — check the returned stderr block |
| Docker errors on first run | Image is pulled on demand; a slow or blocked network looks like a hang |
| Output truncated | `maxOutputChars` limit hit |

## Example prompts

- "Run this Python snippet and show me the output."
- "Time the sort in this JavaScript function."

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
| Known gaps | none known |

## License

MIT
