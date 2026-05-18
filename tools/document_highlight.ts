import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderDocumentHighlights } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspDocumentHighlight(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool(pi, getManager, {
    name: "lsp_document_highlight",
    label: "LSP Document Highlight",
    description: "Find all occurrences of a symbol in the current file",
    promptSnippet: "Find read/write occurrences of a symbol in the current file",
    promptGuidelines: [
      "Use lsp_document_highlight to see read/write usages of a symbol in the current file. Faster than lsp_references when scope is local.",
      "Use lsp_document_highlight as a faster, focused alternative to lsp_references when refactoring within a single file.",
    ],
    method: "textDocument/documentHighlight",
    render: renderDocumentHighlights,
  });
}
