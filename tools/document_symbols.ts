import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderDocumentSymbols } from "./render/index.js";
import {
  CANCELLED,
  lspRenderResult,
  lspRequest,
  normalizePath,
  assertFileExists,
} from "./utils/index.js";

export function registerLspDocumentSymbols(pi: ExtensionAPI, getManager: () => LspManager) {
  pi.registerTool({
    name: "lsp_document_symbols",
    label: "LSP Document Symbols",
    description: "Get outline (functions, classes, variables) of a file",
    promptSnippet: "Get file outline (functions, classes, variables)",
    promptGuidelines: [
      "Use lsp_document_symbols to understand a file's structure before reading it manually.",
      "Use lsp_document_symbols before read when opening a large or unfamiliar file for the first time.",
    ],
    parameters: Type.Object({ path: Type.String() }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as { path: string };
      const filePath = normalizePath(args.path, ctx.cwd);
      await assertFileExists(filePath);
      return lspRequest(
        getManager(),
        "textDocument/documentSymbol",
        {
          textDocument: { uri: `file://${filePath}` },
        },
        { filePath, cwd: ctx.cwd },
        renderDocumentSymbols
      );
    },
    renderResult: lspRenderResult,
  });
}
