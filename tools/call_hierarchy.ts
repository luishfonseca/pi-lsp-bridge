import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderCallHierarchyCalls } from "./render/index.js";
import {
  CANCELLED,
  lspRenderResult,
  lspTwoStepRequest,
  normalizePath,
  resolvePosition,
} from "./utils/index.js";

export function registerLspCallHierarchy(pi: ExtensionAPI, getManager: () => LspManager) {
  pi.registerTool({
    name: "lsp_call_hierarchy",
    label: "LSP Call Hierarchy",
    description: "Find incoming or outgoing calls for a symbol",
    promptSnippet: "Find callers or callees of a function",
    promptGuidelines: [
      "Use lsp_call_hierarchy to find who calls a function (incoming) or what a function calls (outgoing).",
      "Prefer lsp_call_hierarchy over grep when tracing execution flow through function calls.",
    ],
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number({ description: "1-indexed line number" }),
      name: Type.Optional(
        Type.String({ description: "Symbol name that must appear literally on the given line" })
      ),
      includeExternal: Type.Optional(
        Type.Boolean({
          default: true,
          description:
            "When false, results from external files (outside workspace or matching externalPatterns) are hidden",
        })
      ),
      direction: Type.Optional(
        Type.Union([Type.Literal("incoming"), Type.Literal("outgoing")], { default: "incoming" })
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as {
        path: string;
        line: number;
        name?: string;
        direction?: "incoming" | "outgoing";
        includeExternal?: boolean;
      };
      const filePath = normalizePath(args.path, ctx.cwd);
      const { line, character } = await resolvePosition(filePath, args.line, args.name);
      const direction = args.direction ?? "incoming";

      return lspTwoStepRequest(
        getManager(),
        "textDocument/prepareCallHierarchy",
        { textDocument: { uri: `file://${filePath}` }, position: { line, character } },
        direction === "incoming" ? "callHierarchy/incomingCalls" : "callHierarchy/outgoingCalls",
        (items) => items.map((item) => ({ item })),
        { filePath, cwd: ctx.cwd, includeExternal: args.includeExternal },
        renderCallHierarchyCalls
      );
    },
    renderResult: lspRenderResult,
  });
}
