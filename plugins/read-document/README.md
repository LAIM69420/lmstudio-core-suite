# read-document

Reads local documents and returns their text. PDF, DOCX, CSV, JSON, Markdown, code, and plain text, with size and format metadata.

| | |
|---|---|
| Type | tools |
| Tools | 2 |
| Requires network | no |
| Requires external service | no |
| Destructive | yes |
| Version | 1.0.1 |

## Tools

| Tool | What it does |
|---|---|
| `file_metadata` | Size, format, and basic properties without reading the body |
| `read_file` | Return the text content of a supported file |

## Requirements

| Requirement | Detail |
|---|---|
| Supported formats | PDF, DOCX, CSV, JSON, Markdown, source code, plain text |

## Configuration

`allowedDirectories` (comma-separated; resolved against the plugin working directory — default resolves to that directory) and `maxFileSize` in KB.

Configured in LM Studio under Integrations → read-document; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Reads files from disk. The default `allowedDirectories` resolves to the plugin host's working directory; set it to a broad path such as `/` and the model can read anything the host user can. Contents are returned verbatim to the model, including secrets in dotfiles.

## Failure modes

| Symptom | Cause |
|---|---|
| Access denied | Requested path is outside `allowedDirectories` |
| Unsupported format | Binary formats other than PDF/DOCX are refused |
| Garbled PDF text | Scanned PDFs have no text layer — OCR is a separate plugin |

## Example prompts

- "Read ~/notes/plan.md and summarise it."
- "What is the metadata of this PDF?"

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
