import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import type { LspManager } from "./manager.js";

const MAPPERS = {
  textDocument: {
    needsFile: true,
    parameters: Type.Object({ path: Type.String() }),
    buildParams: (p: any) => ({ textDocument: { uri: `file://${p.path}` } }),
  },
  textDocumentPosition: {
    needsFile: true,
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
    }),
    buildParams: (p: any) => ({
      textDocument: { uri: `file://${p.path}` },
      position: { line: p.line, character: p.character },
    }),
  },
  textDocumentPositionContext: {
    needsFile: true,
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
      includeDeclaration: Type.Optional(Type.Boolean({ default: true })),
    }),
    buildParams: (p: any) => ({
      textDocument: { uri: `file://${p.path}` },
      position: { line: p.line, character: p.character },
      context: { includeDeclaration: p.includeDeclaration ?? true },
    }),
  },
  workspaceSymbol: {
    needsFile: false,
    parameters: Type.Object({ query: Type.String() }),
    buildParams: (p: any) => ({ query: p.query }),
  },
};

async function formatResult(obj: unknown): Promise<{ text: string; details?: any }> {
  const json = JSON.stringify(obj, null, 2);
  const t = truncateHead(json, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  if (!t.truncated) {
    return { text: t.content };
  }

  const dir = await mkdtemp(join(tmpdir(), "pi-lsp-"));
  const tempFile = join(dir, "result.json");
  await writeFile(tempFile, json, "utf8");

  const text =
    t.content +
    `\n\n[Output truncated: showing ${t.outputLines} of ${t.totalLines} lines ` +
    `(${formatSize(t.outputBytes)} of ${formatSize(t.totalBytes)}). ` +
    `Full output: ${tempFile}]`;

  return {
    text,
    details: { truncation: t, fullOutputPath: tempFile },
  };
}

export async function registerLspTools(
  pi: ExtensionAPI,
  getManager: () => LspManager,
  preset?: string
) {
  const name = preset ?? "full";
  const here = fileURLToPath(new URL(".", import.meta.url));
  const base = here.endsWith("/dist/") ? resolve(here, "..") : here;
  const file = resolve(base, "tools", `${name}.json`);
  const raw = await readFile(file, "utf8");
  const defs = JSON.parse(raw);

  for (const def of defs) {
    const mapper = (MAPPERS as any)[def.mapper];
    if (!mapper) throw new Error(`Unknown mapper "${def.mapper}" in ${def.name}`);

    pi.registerTool({
      name: def.name,
      label: def.label,
      description: def.description,
      promptSnippet: def.promptSnippet,
      promptGuidelines: def.promptGuidelines,
      parameters: mapper.parameters,
      async execute(_id, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) {
          return { content: [{ type: "text", text: "Cancelled" }], details: { raw: null } };
        }
        const mgr = getManager();
        const args = params as Record<string, any>;
        let filePath = mapper.needsFile ? args.path : undefined;
        if (typeof filePath === "string") {
          filePath = filePath.replace(/^@/, "");
          if (!filePath.startsWith("/")) {
            filePath = resolve(ctx.cwd, filePath);
          }
        }
        const normalizedArgs = { ...args, path: filePath };
        const result = await mgr.request(filePath, def.method, mapper.buildParams(normalizedArgs));
        const formatted = await formatResult(result);
        return {
          content: [{ type: "text", text: formatted.text }],
          details: { raw: result, ...formatted.details },
        };
      },
    });
  }
}
