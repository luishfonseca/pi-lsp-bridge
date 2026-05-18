import { readFile } from "node:fs/promises";
import type { Range } from "vscode-languageserver-protocol";

export function createSnippetReader(fileCache?: Map<string, string>) {
  const cache = fileCache ?? new Map<string, string>();
  return async (uri: string, range: Range): Promise<string | undefined> => {
    const filePath = uri.replace(/^file:\/\//, "");
    let text = cache.get(filePath);
    if (text === undefined) {
      try {
        text = await readFile(filePath, "utf8");
        cache.set(filePath, text);
      } catch {
        return undefined;
      }
    }
    const lines = text.split("\n");
    const start = Math.max(0, range.start.line);
    const end = Math.min(lines.length - 1, range.end.line);
    if (start > end) return undefined;
    return lines.slice(start, end + 1).join("\n");
  };
}
