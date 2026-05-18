import { Location, LocationLink } from "vscode-languageserver-protocol";
import type { RenderContext } from "../utils/types.js";
import { formatRange, formatFilePath, formatExternalTag } from "../utils/format.js";

function isLocationLink(value: unknown): value is LocationLink {
  return (
    value !== null && typeof value === "object" && "targetUri" in (value as Record<string, unknown>)
  );
}

async function renderSingleLocation(
  loc: Location | LocationLink,
  ctx: RenderContext
): Promise<string> {
  if (isLocationLink(loc)) {
    const filePath = formatFilePath(loc.targetUri, ctx.cwd);
    const extTag = formatExternalTag(loc.targetUri, ctx);
    const locStr = `${filePath}:${formatRange(loc.targetRange)}${extTag}`;
    const isExt = ctx.isExternal?.(loc.targetUri) ?? false;
    const snippet =
      ctx.readSnippet && !isExt ? await ctx.readSnippet(loc.targetUri, loc.targetRange) : undefined;
    if (snippet !== undefined) {
      const fence = ctx.language ? "```" + ctx.language : "```";
      return `${locStr}\n${fence}\n${snippet}\n\`\`\``;
    }
    return locStr;
  }

  const filePath = formatFilePath(loc.uri, ctx.cwd);
  const extTag = formatExternalTag(loc.uri, ctx);
  const locStr = `${filePath}:${formatRange(loc.range)}${extTag}`;
  const isExt = ctx.isExternal?.(loc.uri) ?? false;
  const snippet = ctx.readSnippet && !isExt ? await ctx.readSnippet(loc.uri, loc.range) : undefined;
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
  const visibleItems =
    ctx.includeExternal === false && ctx.isExternal
      ? items.filter((item) => {
          const uri = isLocationLink(item) ? item.targetUri : item.uri;
          return !ctx.isExternal!(uri);
        })
      : items;

  if (visibleItems.length === 0) {
    return "No results found.";
  }

  const rendered = await Promise.all(
    visibleItems.map(async (item, i) => {
      const text = await renderSingleLocation(item, ctx);
      const prefix = visibleItems.length === 1 ? "" : `${i + 1}. `;
      return prefix + text.replace(/\n/g, "\n   ");
    })
  );

  return rendered.join("\n\n");
}
