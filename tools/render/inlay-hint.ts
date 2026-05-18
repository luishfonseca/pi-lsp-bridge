import { InlayHintKind } from "vscode-languageserver-protocol";

const inlayHintKindByValue: Record<number, string> = {};
for (const [name, value] of Object.entries(InlayHintKind)) {
  if (typeof value === "number") {
    inlayHintKindByValue[value] = name;
  }
}

export async function renderInlayHints(result: any[] | null): Promise<string> {
  if (!result || result.length === 0) {
    return "No inlay hints found.";
  }

  const lines: string[] = [];
  for (const hint of result) {
    const position = `${hint.position.line + 1}:${hint.position.character}`;
    const label = Array.isArray(hint.label)
      ? hint.label.map((part: any) => part.value).join("")
      : hint.label;
    const kind = hint.kind ? ` [${inlayHintKindByValue[hint.kind] ?? String(hint.kind)}]` : "";
    const tooltip = hint.tooltip
      ? typeof hint.tooltip === "string"
        ? hint.tooltip
        : hint.tooltip.value
      : "";

    lines.push(`- ${position}${kind}: \`${label}\`${tooltip ? ` — ${tooltip}` : ""}`);
  }

  return lines.join("\n");
}
