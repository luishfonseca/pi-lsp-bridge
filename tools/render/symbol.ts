import { DocumentSymbol, SymbolInformation } from "vscode-languageserver-protocol";
import type { RenderContext } from "../utils/types.js";
import { formatKind, formatFilePath } from "../utils/format.js";

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

  if (result.every(isDocumentSymbol)) {
    return renderDocumentSymbolTree(result);
  }

  const lines = (result as SymbolInformation[]).map((sym) => {
    const kind = formatKind(sym.kind);
    const container = sym.containerName ? ` in ${sym.containerName}` : "";
    const filePath = formatFilePath(sym.location.uri, ctx.cwd);
    const loc = ` (${filePath}:${sym.location.range.start.line + 1})`;
    return `- **${sym.name}** \`${kind}\`${container}${loc}`;
  });

  return lines.join("\n");
}
