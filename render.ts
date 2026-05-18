import { relative } from "node:path";
import {
  Hover,
  Location,
  LocationLink,
  DocumentSymbol,
  SymbolInformation,
  WorkspaceSymbol,
  Range,
  SymbolKind,
} from "vscode-languageserver-protocol";

export interface RenderContext {
  readSnippet?: (uri: string, range: Range) => Promise<string | undefined>;
  defaultUri?: string;
  language?: string;
  cwd: string;
}

// ─── SymbolKind reverse lookup ─────────────────────────────────────

const symbolKindByValue: Record<number, string> = {};
for (const [name, value] of Object.entries(SymbolKind)) {
  if (typeof value === "number") {
    symbolKindByValue[value] = name;
  }
}

function formatKind(kind: SymbolKind): string {
  return symbolKindByValue[kind] ?? `Kind(${kind})`;
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatRange(range: Range): string {
  const { start, end } = range;
  if (start.line === end.line) {
    if (start.character === end.character) {
      return `${start.line + 1}:${start.character}`;
    }
    return `${start.line + 1}:${start.character}–${end.character}`;
  }
  return `${start.line + 1}:${start.character}–${end.line + 1}:${end.character}`;
}

function formatFilePath(uri: string, cwd: string): string {
  const absolutePath = uri.replace(/^file:\/\//, "");
  return relative(cwd, absolutePath);
}

function isLocationLink(value: unknown): value is LocationLink {
  return (
    value !== null && typeof value === "object" && "targetUri" in (value as Record<string, unknown>)
  );
}

function isDocumentSymbol(value: unknown): value is DocumentSymbol {
  return (
    value !== null &&
    typeof value === "object" &&
    "name" in (value as Record<string, unknown>) &&
    "kind" in (value as Record<string, unknown>) &&
    "range" in (value as Record<string, unknown>) &&
    "selectionRange" in (value as Record<string, unknown>)
  );
}

// ─── Hover ─────────────────────────────────────────────────────────

export async function renderHover(result: Hover | null): Promise<string> {
  if (!result) {
    return "No hover information found.";
  }

  const { contents } = result;

  if (typeof contents === "string") {
    return contents;
  }

  if (Array.isArray(contents)) {
    const parts = contents.map(
      (
        c: string | { language: string; value: string } | { kind: string; value: string }
      ): string => {
        if (typeof c === "string") return c;
        if ("language" in c) {
          return `\`\`\`${c.language}\n${c.value}\n\`\`\``;
        }
        if ("kind" in c) {
          return c.value;
        }
        return "";
      }
    );
    return parts.filter(Boolean).join("\n\n");
  }

  // Single non-string content: MarkupContent | { language: string; value: string }
  const c = contents as { kind?: string; language?: string; value: string };
  if (c.kind) {
    return c.value;
  }
  if (c.language) {
    return `\`\`\`${c.language}\n${c.value}\n\`\`\``;
  }

  return "No hover information found.";
}

// ─── Locations (definition / references) ───────────────────────────

async function renderSingleLocation(
  loc: Location | LocationLink,
  ctx: RenderContext
): Promise<string> {
  if (isLocationLink(loc)) {
    const filePath = formatFilePath(loc.targetUri, ctx.cwd);
    const locStr = `${filePath}:${formatRange(loc.targetRange)}`;
    const snippet = ctx.readSnippet
      ? await ctx.readSnippet(loc.targetUri, loc.targetRange)
      : undefined;
    if (snippet !== undefined) {
      const fence = ctx.language ? "```" + ctx.language : "```";
      return `${locStr}\n${fence}\n${snippet}\n\`\`\``;
    }
    return locStr;
  }

  const filePath = formatFilePath(loc.uri, ctx.cwd);
  const locStr = `${filePath}:${formatRange(loc.range)}`;
  const snippet = ctx.readSnippet ? await ctx.readSnippet(loc.uri, loc.range) : undefined;
  if (snippet !== undefined) {
    const fence = ctx.language ? "```" + ctx.language : "```";
    return `${locStr}\n${fence}\n${snippet}\n\`\`\``;
  }
  return locStr;
}

export async function renderLocations(
  result: (Location | LocationLink)[] | Location | LocationLink | null,
  ctx: RenderContext
): Promise<string> {
  if (!result) {
    return "No results found.";
  }

  const items = Array.isArray(result) ? result : [result];
  if (items.length === 0) {
    return "No results found.";
  }

  const rendered = await Promise.all(
    items.map(async (item, i) => {
      const text = await renderSingleLocation(item, ctx);
      const prefix = items.length === 1 ? "" : `${i + 1}. `;
      return prefix + text.replace(/\n/g, "\n   ");
    })
  );

  return rendered.join("\n\n");
}

// ─── Document Symbols ──────────────────────────────────────────────

function renderDocumentSymbolTree(symbols: DocumentSymbol[], depth = 0): string {
  const lines: string[] = [];
  for (const sym of symbols) {
    const kind = formatKind(sym.kind);
    const detail = sym.detail ? ` — ${sym.detail}` : "";
    const loc = ` (line ${sym.range.start.line + 1})`;
    const indent = "  ".repeat(depth);
    lines.push(`${indent}- **${sym.name}** \`${kind}\`${detail}${loc}`);

    if (sym.children && sym.children.length > 0) {
      lines.push(renderDocumentSymbolTree(sym.children, depth + 1));
    }
  }
  return lines.join("\n");
}

export async function renderDocumentSymbols(
  result: DocumentSymbol[] | SymbolInformation[] | null,
  ctx: RenderContext
): Promise<string> {
  if (!result || result.length === 0) {
    return "No symbols found.";
  }

  // DocumentSymbol[] has a tree structure
  if (result.every(isDocumentSymbol)) {
    return renderDocumentSymbolTree(result);
  }

  // Fallback for SymbolInformation[] (flat list)
  const lines = (result as SymbolInformation[]).map((sym) => {
    const kind = formatKind(sym.kind);
    const container = sym.containerName ? ` in ${sym.containerName}` : "";
    const filePath = formatFilePath(sym.location.uri, ctx.cwd);
    const loc = ` (${filePath}:${sym.location.range.start.line + 1})`;
    return `- **${sym.name}** \`${kind}\`${container}${loc}`;
  });

  return lines.join("\n");
}

// ─── Workspace Symbols ─────────────────────────────────────────────

export async function renderWorkspaceSymbols(
  result: (SymbolInformation | WorkspaceSymbol)[] | null,
  ctx: RenderContext
): Promise<string> {
  if (!result || result.length === 0) {
    return "No symbols found.";
  }

  const lines: string[] = [];
  for (const sym of result) {
    const kind = formatKind(sym.kind);
    const container = "containerName" in sym && sym.containerName ? ` in ${sym.containerName}` : "";

    let loc = "";
    if ("location" in sym && sym.location) {
      const locObj = sym.location;
      const filePath = formatFilePath(locObj.uri, ctx.cwd);
      if ("range" in locObj && locObj.range) {
        loc = ` (${filePath}:${locObj.range.start.line + 1})`;
      } else {
        loc = ` (${filePath})`;
      }
    }

    lines.push(`- **${sym.name}** \`${kind}\`${container}${loc}`);
  }

  return lines.join("\n");
}
