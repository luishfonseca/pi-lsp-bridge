import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type ServerConfig = {
  command: string;
  args?: string[];
};

export type LspConfig = {
  /** Map file extension (including dot) to server key */
  extMap: Record<string, string>;
  /** Server definitions */
  servers: Record<string, ServerConfig>;
  /** Preset name (loads tools/<preset>.json). Defaults to "full". */
  preset?: string;
};

export async function loadConfig(cwd: string): Promise<LspConfig | null> {
  const paths = [
    resolve(cwd, ".pi/lsp.json"),
    resolve(process.env.HOME ?? "~", ".pi/agent/lsp.json"),
  ];
  for (const p of paths) {
    try {
      const raw = await readFile(p, "utf8");
      return JSON.parse(raw) as LspConfig;
    } catch {
      // file missing or malformed, keep looking
    }
  }
  return null;
}
