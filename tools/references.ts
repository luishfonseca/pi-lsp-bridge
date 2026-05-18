import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderLocations } from "./render/index.js";
import { registerPositionTool } from "./utils/index.js";

export function registerLspReferences(pi: ExtensionAPI, getManager: () => LspManager) {
  registerPositionTool<{
    path: string;
    line: number;
    name?: string;
    includeDeclaration?: boolean;
    includeExternal?: boolean;
  }>(pi, getManager, {
    name: "lsp_references",
    label: "LSP References",
    description: "Find references to a symbol via LSP",
    promptSnippet: "Find all usages of a symbol",
    promptGuidelines: [
      "Use lsp_references before any refactoring to understand blast radius. Do not rely on grep for this.",
      "If lsp_references returns too many results, narrow the scope with lsp_document_highlight in the current file.",
    ],
    method: "textDocument/references",
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number({ description: "1-indexed line number" }),
      name: Type.Optional(
        Type.String({ description: "Symbol name to look up. If not found on the exact line, the nearest match within ±10 lines is used with a warning." })
      ),
      includeDeclaration: Type.Optional(Type.Boolean({ default: true })),
      includeExternal: Type.Optional(
        Type.Boolean({
          default: true,
          description:
            "When false, results from external files (outside workspace or matching externalPatterns) are hidden",
        })
      ),
    }),
    render: renderLocations,
    extraParams: (args) => ({
      context: { includeDeclaration: args.includeDeclaration ?? true },
    }),
  });
}
