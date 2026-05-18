import { Type } from "typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import type { LspManager } from "./manager.js";

function posParams() {
  return Type.Object({
    path: Type.String({ description: "Absolute or relative file path" }),
    line: Type.Number({ description: "0-based line number" }),
    character: Type.Number({ description: "0-based character/ column" }),
  });
}

function formatResult(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  const t = truncateHead(json, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  if (!t.truncated) return t.content;
  return (
    t.content +
    `\n\n[Truncated: ${t.outputLines}/${t.totalLines} lines, ${t.outputBytes}/${t.totalBytes} bytes]`
  );
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
      async execute(_id, params, signal) {
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "Cancelled" }],
            details: { raw: null },
          };
        }
        const mgr = getManager();
        const args = params as Record<string, any>;
        const result = await mgr.request(args.path, method, buildParams(args));
        return {
          content: [{ type: "text", text: formatResult(result) }],
          details: { raw: result },
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
