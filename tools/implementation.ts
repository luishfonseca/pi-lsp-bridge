import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderLocations } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspImplementation(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool(pi, getManager, {
    name: "lsp_implementation",
    label: "LSP Implementation",
    description: "Find implementations of an interface or abstract method",
    promptSnippet: "Find implementations of a symbol",
    promptGuidelines: [
      "Use lsp_implementation to find concrete classes that implement an interface or override an abstract method.",
      "Use lsp_implementation after lsp_hover or lsp_definition on an interface to find all concrete implementations.",
    ],
    method: "textDocument/implementation",
    render: renderLocations,
  });
}
