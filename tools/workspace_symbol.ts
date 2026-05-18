import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderWorkspaceSymbols } from "./render/index.js";
import { CANCELLED, lspRenderResult, lspRequest } from "./utils/index.js";

export function registerLspWorkspaceSymbol(pi: ExtensionAPI, getManager: () => LspManager) {
  pi.registerTool({
    name: "lsp_workspace_symbol",
    label: "LSP Workspace Symbol",
    description: "Search symbols across the entire workspace",
    promptSnippet: "Search symbols across the entire workspace",
    promptGuidelines: [
      "Use lsp_workspace_symbol when you know a symbol name but not its file. Do not guess paths.",
      "After finding a symbol with lsp_workspace_symbol, use lsp_definition to jump to it.",
    ],
    parameters: Type.Object({
      query: Type.String(),
      includeExternal: Type.Optional(
        Type.Boolean({
          default: true,
          description:
            "When false, results from external files (outside workspace or matching externalPatterns) are hidden",
        })
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as { query: string; includeExternal?: boolean };
      return lspRequest(
        getManager(),
        "workspace/symbol",
        { query: args.query },
        { broadcast: true, cwd: ctx.cwd, includeExternal: args.includeExternal },
        renderWorkspaceSymbols
      );
    },
    renderResult: lspRenderResult,
  });
}
