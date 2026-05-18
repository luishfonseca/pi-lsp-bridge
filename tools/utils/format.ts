import { relative } from "node:path";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import { SymbolKind, type Range } from "vscode-languageserver-protocol";

export async function formatResult(text: string): Promise<{ text: string; details?: any }> {
  const t = truncateHead(text, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  if (!t.truncated) {
    return { text: t.content };
  }

  return {
    text:
      t.content +
      `\n\n[Output truncated: showing ${t.outputLines} of ${t.totalLines} lines ` +
      `(${formatSize(t.outputBytes)} of ${formatSize(t.totalBytes)}).]`,
    details: { truncation: t },
  };
}

export function formatRange(range: Range): string {
  const { start, end } = range;
  if (start.line === end.line) {
    if (start.character === end.character) {
      return `${start.line + 1}:${start.character}`;
    }
    return `${start.line + 1}:${start.character}–${end.character}`;
  }
  return `${start.line + 1}:${start.character}–${end.line + 1}:${end.character}`;
}

export function formatFilePath(uri: string, cwd: string): string {
  const absolutePath = uri.replace(/^file:\/\//, "");
  return relative(cwd, absolutePath);
}

const symbolKindByValue: Record<number, string> = {};
for (const [name, value] of Object.entries(SymbolKind)) {
  if (typeof value === "number") {
    symbolKindByValue[value] = name;
  }
}

export function formatKind(kind: SymbolKind): string {
  return symbolKindByValue[kind] ?? `Kind(${kind})`;
}

export function formatExternalTag(
  uri: string,
  ctx: { isExternal?: (uri: string) => boolean }
): string {
  if (!ctx.isExternal) return "";
  return ctx.isExternal(uri) ? " `(external)`" : "";
}
