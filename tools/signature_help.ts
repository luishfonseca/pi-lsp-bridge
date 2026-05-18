import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderSignatureHelp } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspSignatureHelp(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool(pi, getManager, {
    name: "lsp_signature_help",
    label: "LSP Signature Help",
    description: "Get signature help (parameter info) at a call site",
    promptSnippet: "Get parameter types and names at a function call site",
    promptGuidelines: [
      "Use lsp_signature_help when inside a function call to see expected parameters and their types.",
      "Prefer lsp_signature_help over lsp_hover when actively typing inside a function call and need parameter guidance.",
      "Target a parameter name or any token inside the parentheses, not the function name itself.",
    ],
    method: "textDocument/signatureHelp",
    render: renderSignatureHelp,
  });
}
