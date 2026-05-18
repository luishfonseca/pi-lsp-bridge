import { DocumentHighlightKind, type Range } from "vscode-languageserver-protocol";
import type { RenderContext } from "../utils/types.js";
import { formatRange } from "../utils/format.js";

const highlightKindByValue: Record<number, string> = {};
for (const [name, value] of Object.entries(DocumentHighlightKind)) {
  if (typeof value === "number") {
    highlightKindByValue[value] = name;
  }
}

export async function renderDocumentHighlights(
  result: Array<{ range: Range; kind?: number }> | null,
  ctx: RenderContext
): Promise<string> {
  if (!result || result.length === 0) {
    return "No highlights found.";
  }

  const lines: string[] = [];
  for (const item of result) {
    const kind = highlightKindByValue[item.kind ?? DocumentHighlightKind.Text] ?? "Text";
    const range = formatRange(item.range);
    const snippet =
      ctx.readSnippet && ctx.defaultUri
        ? await ctx.readSnippet(ctx.defaultUri, item.range)
        : undefined;
    if (snippet !== undefined) {
      const fence = ctx.language ? "```" + ctx.language : "```";
      lines.push(`- **${kind}** ${range}\n${fence}\n${snippet}\n\`\`\``);
    } else {
      lines.push(`- **${kind}** ${range}`);
    }
  }

  return lines.join("\n");
}
