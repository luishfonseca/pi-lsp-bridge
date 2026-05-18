import { SymbolInformation, WorkspaceSymbol } from "vscode-languageserver-protocol";
import type { RenderContext } from "../utils/types.js";
import { formatKind, formatFilePath, formatExternalTag } from "../utils/format.js";

export async function renderWorkspaceSymbols(
  result: (SymbolInformation | WorkspaceSymbol)[] | null,
  ctx: RenderContext
): Promise<string> {
  if (!result || result.length === 0) {
    return "No symbols found.";
  }

  const lines: string[] = [];
  for (const sym of result) {
    let uri: string | undefined;
    if ("location" in sym && sym.location) {
      uri = sym.location.uri;
    }

    const isExt = uri && ctx.isExternal ? ctx.isExternal(uri) : false;
    if (isExt && ctx.includeExternal === false) continue;

    const kind = formatKind(sym.kind);
    const container = "containerName" in sym && sym.containerName ? ` in ${sym.containerName}` : "";
    const extTag = uri ? formatExternalTag(uri, ctx) : "";

    let loc = "";
    if (uri) {
      const filePath = formatFilePath(uri, ctx.cwd);
      if ("location" in sym && sym.location && "range" in sym.location && sym.location.range) {
        loc = ` (${filePath}:${sym.location.range.start.line + 1})`;
      } else {
        loc = ` (${filePath})`;
      }
    }

    lines.push(`- **${sym.name}** \`${kind}\`${container}${extTag}${loc}`);
  }

  return lines.join("\n");
}
