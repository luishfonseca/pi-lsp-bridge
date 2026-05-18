import type { RenderContext } from "../utils/types.js";
import { formatKind, formatRange, formatFilePath, formatExternalTag } from "../utils/format.js";

export async function renderCallHierarchyCalls(result: any[], ctx: RenderContext): Promise<string> {
  if (result.length === 0) {
    return "No call hierarchy results found.";
  }

  const lines: string[] = [];
  for (const call of result) {
    const item = call.from ?? call.to;
    if (!item) continue;

    const isExt = ctx.isExternal?.(item.uri) ?? false;
    if (isExt && ctx.includeExternal === false) continue;

    const name = item.name;
    const kind = formatKind(item.kind);
    const detail = item.detail ? ` — ${item.detail}` : "";
    const extTag = formatExternalTag(item.uri, ctx);
    const filePath = formatFilePath(item.uri, ctx.cwd);
    const range = formatRange(item.range);

    let line = `- **${name}** \`${kind}\`${detail}${extTag} (${filePath}:${range})`;

    const ranges = call.fromRanges ?? [];
    if (ranges.length > 0 && ctx.readSnippet && !isExt) {
      const snippet = await ctx.readSnippet(item.uri, ranges[0]);
      if (snippet !== undefined) {
        const fence = ctx.language ? "```" + ctx.language : "```";
        line += `\n${fence}\n${snippet}\n\`\`\``;
      }
    }

    lines.push(line);
  }

  return lines.join("\n\n");
}
