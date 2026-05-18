import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { renderTypeHierarchyItems } from "./render/index.js";
import {
  CANCELLED,
  lspRenderResult,
  lspTwoStepRequest,
  normalizePath,
  resolvePosition,
  formatFuzzyWarning,
} from "./utils/index.js";

export function registerLspTypeHierarchy(pi: ExtensionAPI, getManager: () => LspManager) {
  pi.registerTool({
    name: "lsp_type_hierarchy",
    label: "LSP Type Hierarchy",
    description: "Find supertypes or subtypes of a type",
    promptSnippet: "Find parent or derived types of a class or interface",
    promptGuidelines: [
      "Use lsp_type_hierarchy to find parent types (supertypes) or derived types (subtypes) of a class or interface.",
      "Use lsp_type_hierarchy when refactoring inheritance hierarchies or finding all implementations of an interface.",
    ],
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number({ description: "1-indexed line number" }),
      name: Type.Optional(
        Type.String({ description: "Symbol name to look up. If not found on the exact line, the nearest match within ±10 lines is used with a warning." })
      ),
      includeExternal: Type.Optional(
        Type.Boolean({
          default: true,
          description:
            "When false, results from external files (outside workspace or matching externalPatterns) are hidden",
        })
      ),
      direction: Type.Optional(
        Type.Union([Type.Literal("supertypes"), Type.Literal("subtypes")], { default: "subtypes" })
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as {
        path: string;
        line: number;
        name?: string;
        direction?: "supertypes" | "subtypes";
        includeExternal?: boolean;
      };
      const filePath = normalizePath(args.path, ctx.cwd);
      const { line, character, fuzzy } = await resolvePosition(filePath, args.line, args.name);
      const direction = args.direction ?? "subtypes";

      const result = await lspTwoStepRequest(
        getManager(),
        "textDocument/prepareTypeHierarchy",
        { textDocument: { uri: `file://${filePath}` }, position: { line, character } },
        direction === "supertypes" ? "typeHierarchy/supertypes" : "typeHierarchy/subtypes",
        (items) => items.map((item) => ({ item })),
        { filePath, cwd: ctx.cwd, includeExternal: args.includeExternal },
        renderTypeHierarchyItems
      );

      if (fuzzy) {
        result.content[0].text = formatFuzzyWarning(fuzzy) + result.content[0].text;
        result.details = result.details ?? {};
        result.details.fuzzy = fuzzy;
      }

      return result;
    },
    renderResult: lspRenderResult,
  });
}
