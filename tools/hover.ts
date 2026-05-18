import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderHover } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspHover(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool(pi, getManager, {
    name: "lsp_hover",
    label: "LSP Hover",
    description: "Get hover information (types, docs) from the language server",
    promptSnippet: "Get type/docs info at a file position",
    promptGuidelines: [
      "Prefer lsp_hover over read when you need a symbol's type, documentation, or signature. It is faster and more precise.",
      "Use lsp_hover as the first tool when examining unfamiliar code in a file.",
    ],
    method: "textDocument/hover",
    render: renderHover,
  });
}
