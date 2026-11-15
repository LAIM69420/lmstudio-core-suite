# Plugin README template

Use this for every plugin in an `lmstudio-*-suite` repo. Sections are mandatory unless marked optional.
Delete the guidance lines once written; keep the headings in this order.

---

# <plugin-name>

<One paragraph: what it does, and the user-facing problem it solves. No marketing.>

| | |
|---|---|
| Type | tools / prompt-preprocessor / generator |
| Tools | `<count>` |
| Requires network | yes/no |
| Requires external service | yes/no — name it |
| Destructive | yes/no — see *Privileged surface* |
| SDK | `@lmstudio/sdk` ^1.5.0 |
| Version | x.y.z |

## What it does

<2–4 bullets. Concrete behaviour, not adjectives.>

## Requirements

| Requirement | Detail |
|---|---|
| Node | runs in the LM Studio plugin runtime |
| Service | e.g. SearXNG on `127.0.0.1:8080`, Tor SOCKS on `127.0.0.1:9050` |
| Credentials | which config field, and what it unlocks |

## Configuration

| Field | Type | Default | Purpose |
|---|---|---|---|

## Tools

| Tool | Arguments | Returns | Side effects |
|---|---|---|---|

Mark any tool that writes, executes, deletes, or leaves the machine in the *Side effects* column.

## Privileged surface

<Only for plugins that execute code, touch the filesystem, handle secrets, or mutate process-global state.
State exactly what the plugin can reach and what it cannot. If nothing applies, say "None.">

## Failure modes

| Symptom | Cause |
|---|---|

## Example prompts

- "<prompt that exercises the main tool>"

## Development

```bash
npm install    # also installs the plugin via lms dev --install
npm run build  # tsc
```

## Status

| Item | State |
|---|---|
| Tests | none / smoke harness / suite |
| LM Studio | last verified against `<version>` |
| Known gaps | anything true but unflattering |

## License

MIT
