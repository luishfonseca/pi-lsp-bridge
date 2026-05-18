import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderLocations } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspDeclaration(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool(pi, getManager, {
    name: "lsp_declaration",
    label: "LSP Declaration",
    description: "Go to declaration via LSP",
    promptSnippet: "Jump to a symbol's declaration",
    promptGuidelines: [
      "Use lsp_declaration for forward declarations or interface declarations. For implementations, prefer lsp_definition.",
      "Use lsp_declaration when you need the contract or signature site; use lsp_definition for the concrete body.",
    ],
    method: "textDocument/declaration",
    render: renderLocations,
  });
}
