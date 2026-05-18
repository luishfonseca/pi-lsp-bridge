import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import type { LspManager } from "./manager.js";

function posParams() {
  return Type.Object({
    path: Type.String({ description: "Absolute or relative file path" }),
    line: Type.Number({ description: "0-based line number" }),
    character: Type.Number({ description: "0-based character/ column" }),
  });
}

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

export function registerLspTools(pi: ExtensionAPI, getManager: () => LspManager) {
  const mk = (
    name: string,
    label: string,
    description: string,
    parameters: any,
    method: string,
    buildParams: (p: any) => any
  ) => {
    pi.registerTool({
      name,
      label,
      description,
      parameters,
      async execute(_id, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "Cancelled" }],
            details: { raw: null },
          };
        }
        const mgr = getManager();
        const args = params as Record<string, any>;
        let filePath = args.path;
        if (typeof filePath === "string") {
          filePath = filePath.replace(/^@/, "");
          if (!filePath.startsWith("/")) {
            filePath = resolve(ctx.cwd, filePath);
          }
        }
        const normalizedArgs = { ...args, path: filePath };
        const result = await mgr.request(filePath, method, buildParams(normalizedArgs));
        const formatted = await formatResult(result);
        return {
          content: [{ type: "text", text: formatted.text }],
          details: { raw: result, ...formatted.details },
        };
      },
    });
  };

  mk(
    "lsp_hover",
    "LSP Hover",
    "Get hover information (types, docs) from the language server",
    posParams(),
    "textDocument/hover",
    (p) => ({
      textDocument: { uri: `file://${p.path}` },
      position: { line: p.line, character: p.character },
    })
  );

  mk(
    "lsp_definition",
    "LSP Definition",
    "Go to definition via LSP",
    posParams(),
    "textDocument/definition",
    (p) => ({
      textDocument: { uri: `file://${p.path}` },
      position: { line: p.line, character: p.character },
    })
  );

  mk(
    "lsp_references",
    "LSP References",
    "Find references to a symbol via LSP",
    Type.Object({
      ...posParams().properties,
      includeDeclaration: Type.Optional(Type.Boolean({ default: true })),
    }),
    "textDocument/references",
    (p) => ({
      textDocument: { uri: `file://${p.path}` },
      position: { line: p.line, character: p.character },
      context: { includeDeclaration: p.includeDeclaration ?? true },
    })
  );

  mk(
    "lsp_document_symbols",
    "LSP Document Symbols",
    "Get outline (functions, classes, variables) of a file",
    Type.Object({ path: Type.String() }),
    "textDocument/documentSymbol",
    (p) => ({ textDocument: { uri: `file://${p.path}` } })
  );

  mk(
    "lsp_workspace_symbol",
    "LSP Workspace Symbol",
    "Search symbols across the entire workspace",
    Type.Object({ query: Type.String() }),
    "workspace/symbol",
    (p) => ({ query: p.query })
  );
}
