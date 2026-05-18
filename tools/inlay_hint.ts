import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderInlayHints } from "./render/index.js";
import {
  CANCELLED,
  lspRenderResult,
  lspRequest,
  normalizePath,
  resolveRange,
} from "./utils/index.js";

export function registerLspInlayHint(pi: ExtensionAPI, getManager: () => LspManager) {
  pi.registerTool({
    name: "lsp_inlay_hint",
    label: "LSP Inlay Hint",
    description: "Get inlay hints (inferred types, parameter names) for a range",
    promptSnippet: "Show inferred types and parameter names inline",
    promptGuidelines: [
      "Use lsp_inlay_hint to see inferred types and parameter names that the server provides inline.",
      "Use lsp_inlay_hint when reviewing code to see inferred types the server recommends without modifying the file.",
    ],
    parameters: Type.Object({
      path: Type.String(),
      startLine: Type.Number({ description: "1-indexed start line" }),
      endLine: Type.Number({ description: "1-indexed end line" }),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as { path: string; startLine: number; endLine: number };
      const filePath = normalizePath(args.path, ctx.cwd);
      const { start, end } = await resolveRange(filePath, args.startLine, args.endLine);

      return lspRequest(
        getManager(),
        "textDocument/inlayHint",
        {
          textDocument: { uri: `file://${filePath}` },
          range: { start, end },
        },
        { filePath, cwd: ctx.cwd },
        renderInlayHints
      );
    },
    renderResult: lspRenderResult,
  });
}
