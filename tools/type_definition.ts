import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderLocations } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspTypeDefinition(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool(pi, getManager, {
    name: "lsp_type_definition",
    label: "LSP Type Definition",
    description: "Go to the definition of a symbol's type",
    promptSnippet: "Jump to a symbol's type definition",
    promptGuidelines: [
      "Use lsp_type_definition when you need to know the concrete type of a variable.",
      "Prefer lsp_type_definition over lsp_hover when you need the full type definition rather than a brief summary.",
    ],
    method: "textDocument/typeDefinition",
    render: renderLocations,
  });
}
