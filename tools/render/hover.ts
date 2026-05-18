import { Hover } from "vscode-languageserver-protocol";

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

  const c = contents as { kind?: string; language?: string; value: string };
  if (c.kind) {
    return c.value;
  }
  if (c.language) {
    return `\`\`\`${c.language}\n${c.value}\n\`\`\``;
  }

  return "No hover information found.";
}
