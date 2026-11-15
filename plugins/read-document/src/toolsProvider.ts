import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";

import { buildConfigSchematics } from "./configSchematics.js";

const configSchematics = buildConfigSchematics();

// ---------------------------------------------------------------------------
// Supported text extensions
// ---------------------------------------------------------------------------
const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".mdx", ".json", ".csv", ".tsv",
  ".js", ".ts", ".jsx", ".tsx", ".py", ".rs", ".go", ".rb", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".kt", ".scala",
  ".sh", ".bash", ".zsh", ".ps1", ".bat",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
  ".xml", ".html", ".htm", ".css", ".scss", ".less",
  ".sql", ".r", ".m", ".mm", ".pl", ".pm",
  ".tex", ".bib",
]);

// ── Magic byte detection ──────────────────────────────────────────────────

async function detectFormat(filePath: string): Promise<"pdf" | "docx" | "text" | "binary"> {
  try {
    const fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(8);
    await fd.read(buf, 0, 8, 0);
    await fd.close();

    const head = buf.toString("utf-8");
    if (head.startsWith("%PDF-")) return "pdf";

    // DOCX (ZIP archive with [Content_Types].xml)
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      // Read more to check for [Content_Types]
      const fd2 = await fs.open(filePath, "r");
      const buf2 = Buffer.alloc(4096);
      await fd2.read(buf2, 0, 4096, 0);
      await fd2.close();
      const str = buf2.toString("utf-8");
      if (str.includes("[Content_Types].xml")) return "docx";
    }

    return "text";
  } catch {
    return "binary";
  }
}

// ── Readers ───────────────────────────────────────────────────────────────

async function readPdfText(filePath: string): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function readDocxText(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// ── Section extraction ────────────────────────────────────────────────────

function extractSections(text: string, section?: string): string {
  if (!section) return text;

  const lines = text.split("\n");

  // Try page range: "1-5" or "3"
  const pageMatch = section.match(/^(\d+)(?:-(\d+))?$/);
  if (pageMatch) {
    // Estimate: ~50 lines per page
    const linesPerPage = 50;
    const start = (parseInt(pageMatch[1]) - 1) * linesPerPage;
    const end = pageMatch[2]
      ? parseInt(pageMatch[2]) * linesPerPage
      : start + linesPerPage;
    const sliced = lines.slice(Math.max(0, start), Math.min(lines.length, end));
    if (sliced.length === 0) return `[Section "${section}" is empty or out of range.]`;
    return sliced.join("\n");
  }

  // Try heading match: "## Introduction" — find that heading and take next N lines
  const headingLines: number[] = [];
  lines.forEach((line, i) => {
    if (line.match(/^#{1,6}\s/) || line.match(/^[A-Z][^a-z]+$/) || line.match(/^[A-Z][a-z]+:/)) {
      headingLines.push(i);
    }
  });

  if (headingLines.length > 0) {
    const lowerSection = section.toLowerCase();
    for (let h = 0; h < headingLines.length; h++) {
      const headingText = lines[headingLines[h]].toLowerCase();
      if (headingText.includes(lowerSection)) {
        const start = headingLines[h];
        const end = headingLines[h + 1] ?? lines.length;
        const sliced = lines.slice(start, Math.min(end, start + 500));
        return sliced.join("\n");
      }
    }
  }

  return text;
}

// ── Tools Provider ────────────────────────────────────────────────────────

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);
  const allowedDirsRaw: string = config.get("allowedDirectories");
  const maxFileSizeKb: number = config.get("maxFileSize");
  const maxFileSizeBytes = maxFileSizeKb * 1024;

  const allowedDirs = allowedDirsRaw
    .split(",")
    .map((s) => path.resolve(s.trim()))
    .filter(Boolean);

  // ── Security check helper ──────────────────────────────────────────────
  function checkAllowed(resolved: string): string | null {
    if (allowedDirs.length === 0) return null;
    const inBounds = allowedDirs.some(
      (dir) => resolved.startsWith(dir + path.sep) || resolved === dir,
    );
    if (!inBounds) {
      return [
        `Access denied: file is outside allowed directories.`,
        `Allowed: ${allowedDirs.join(", ")}`,
        `Requested: ${resolved}`,
      ].join("\n");
    }
    return null;
  }

  // ── read_file ──────────────────────────────────────────────────────────
  const readTool = tool({
    name: "read_file",
    description: [
      "Read the content of a local file. Supports PDF (text), DOCX, CSV, JSON, Markdown, and most code/text files.",
      "Use section to read a specific page range (e.g. '1-5') or heading section (e.g. 'Introduction').",
    ].join(" "),
    parameters: {
      filePath: z.string().min(1).describe("Absolute or relative path to the file"),
      maxLines: z.number().int().min(0).optional().describe("Max lines to return (0 or omit for all)"),
      section: z.string().optional().describe("Page range ('1-5'), single page ('3'), or heading name ('Introduction')"),
    },
    async implementation({ filePath, maxLines, section }) {
      const resolved = path.resolve(filePath);
      const securityErr = checkAllowed(resolved);
      if (securityErr) return securityErr;

      let stat: fsSync.Stats;
      try {
        stat = await fs.stat(resolved);
      } catch (err: any) {
        if (err.message?.includes("ENOENT")) return `File not found: ${filePath}`;
        return `Error accessing file: ${err.message || err}`;
      }

      if (stat.size > maxFileSizeBytes) {
        return [
          `File too large (${(stat.size / 1024).toFixed(1)} KB).`,
          `Max allowed: ${maxFileSizeKb} KB. Increase maxFileSize in settings.`,
        ].join(" ");
      }

      try {
        const ext = path.extname(resolved).toLowerCase();
        const format = await detectFormat(resolved);
        let text: string;

        if (format === "pdf") {
          text = await readPdfText(resolved);
        } else if (format === "docx") {
          text = await readDocxText(resolved);
        } else if (TEXT_EXTENSIONS.has(ext) || ext === "") {
          text = await fs.readFile(resolved, "utf-8");
        } else {
          return `Unsupported format: ${ext || "(none)"}. Supported: PDF, DOCX, ${[...TEXT_EXTENSIONS].slice(0, 20).join(", ")}...`;
        }

        // Apply section filter
        if (section) {
          text = extractSections(text, section);
        }

        return trimLines(text, maxLines ?? 0);
      } catch (err: any) {
        return `Error reading file: ${err.message || err}`;
      }
    },
  });

  // ── file_metadata ──────────────────────────────────────────────────────
  const metadataTool = tool({
    name: "file_metadata",
    description: "Get metadata about a local file: size, type, line count (text), page count (PDF), last modified, and word count.",
    parameters: {
      filePath: z.string().min(1).describe("Absolute or relative path to the file"),
    },
    async implementation({ filePath }) {
      const resolved = path.resolve(filePath);
      const securityErr = checkAllowed(resolved);
      if (securityErr) return securityErr;

      try {
        const stat = await fs.stat(resolved);
        const format = await detectFormat(resolved);
        const ext = path.extname(resolved).toLowerCase();

        const lines: string[] = [
          `📁 ${path.basename(resolved)}`,
          `   Path: ${resolved}`,
          `   Size: ${(stat.size / 1024).toFixed(1)} KB (${stat.size} bytes)`,
          `   Format: ${format === "text" ? (ext || "unknown") : format.toUpperCase()}`,
          `   Modified: ${stat.mtime.toISOString().slice(0, 19)}`,
          `   Created: ${stat.birthtime.toISOString().slice(0, 19)}`,
        ];

        // Text formats: count lines, words, chars
        if (format === "text" || format === "pdf" || format === "docx") {
          let content: string;
          if (format === "pdf") {
            content = await readPdfText(resolved);
          } else if (format === "docx") {
            content = await readDocxText(resolved);
          } else {
            content = await fs.readFile(resolved, "utf-8");
          }

          const charCount = content.length;
          const lineCount = content.split("\n").length;
          const wordCount = content.split(/\s+/).filter(Boolean).length;

          lines.push(`   Lines: ${lineCount.toLocaleString()}`);
          lines.push(`   Words: ${wordCount.toLocaleString()}`);
          lines.push(`   Characters: ${charCount.toLocaleString()}`);
        }

        return lines.join("\n");
      } catch (err: any) {
        if (err.message?.includes("ENOENT")) return `File not found: ${filePath}`;
        return `Error: ${err.message || err}`;
      }
    },
  });

  return [readTool, metadataTool];
};

// ── Helper ────────────────────────────────────────────────────────────────

function trimLines(text: string, maxLines: number): string {
  if (maxLines <= 0) return text;
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  const kept = lines.slice(0, maxLines);
  kept.push(`\n... (${lines.length - maxLines} more lines omitted)`);
  return kept.join("\n");
}
