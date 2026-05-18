import { Type, type TSchema } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../../manager.js";
import type { RenderContext } from "./types.js";
import { normalizePath } from "./path.js";
import { resolvePosition } from "./position.js";
import { lspRequest } from "./lsp.js";
import { lspRenderResult } from "./result.js";

export const CANCELLED = {
  content: [{ type: "text" as const, text: "Cancelled" }],
  details: { raw: null },
};

export interface PositionToolOptions<
  TParams extends { path: string; line: number; name?: string; includeExternal?: boolean } = {
    path: string;
    line: number;
    name?: string;
    includeExternal?: boolean;
  },
> {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines?: string[];
  method: string;
  parameters?: TSchema;
  render: (result: any, ctx: RenderContext) => Promise<string>;
  broadcast?: boolean;
  extraParams?: (args: TParams) => Record<string, unknown>;
}

export function registerPositionTool<
  TParams extends { path: string; line: number; name?: string; includeExternal?: boolean },
>(pi: ExtensionAPI, getManager: () => LspManager, options: PositionToolOptions<TParams>) {
  const defaultParams = Type.Object({
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
  });

  pi.registerTool({
    name: options.name,
    label: options.label,
    description: options.description,
    promptSnippet: options.promptSnippet,
    promptGuidelines: options.promptGuidelines,
    parameters: (options.parameters ?? defaultParams) as any,
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as TParams;
      const filePath = normalizePath(args.path, ctx.cwd);
      const { line, character } = await resolvePosition(filePath, args.line, args.name);

      const lspParams: Record<string, unknown> = {
        textDocument: { uri: `file://${filePath}` },
        position: { line, character },
      };

      if (options.extraParams) {
        Object.assign(lspParams, options.extraParams(args));
      }

      return lspRequest(
        getManager(),
        options.method,
        lspParams,
        {
          filePath,
          broadcast: options.broadcast,
          cwd: ctx.cwd,
          includeExternal: args.includeExternal,
        },
        options.render
      );
    },
    renderResult: lspRenderResult,
  });
}
