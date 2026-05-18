import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderLocations } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspDefinition(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool(pi, getManager, {
    name: "lsp_definition",
    label: "LSP Definition",
    description: "Go to definition via LSP",
    promptSnippet: "Jump to a symbol's definition",
    promptGuidelines: [
      "Use lsp_definition to jump directly to a symbol's declaration instead of guessing filenames or grepping.",
      "After lsp_workspace_symbol finds a symbol, use lsp_definition to navigate to it.",
    ],
    method: "textDocument/definition",
    render: renderLocations,
  });
}
