import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import type { LspManager } from "./manager.js";

async function formatResult(obj: unknown): Promise<{ text: string; details?: any }> {
  const json = JSON.stringify(obj, null, 2);
  const t = truncateHead(json, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  if (!t.truncated) {
    return { text: t.content };
  }

  const dir = await mkdtemp(join(tmpdir(), "pi-lsp-"));
  const tempFile = join(dir, "result.json");
  await writeFile(tempFile, json, "utf8");

  const text =
    t.content +
    `\n\n[Output truncated: showing ${t.outputLines} of ${t.totalLines} lines ` +
    `(${formatSize(t.outputBytes)} of ${formatSize(t.totalBytes)}). ` +
    `Full output: ${tempFile}]`;

  return {
    text,
    details: { truncation: t, fullOutputPath: tempFile },
  };
}

export async function registerLspTools(
  pi: ExtensionAPI,
  getManager: () => LspManager,
  _preset?: string
) {
  pi.registerTool({
    name: "lsp_hover",
    label: "LSP Hover",
    description: "Get hover information (types, docs) from the language server",
    promptSnippet: "Get type/docs info at a file position",
    promptGuidelines: ["Use lsp_hover when you need to verify a symbol's type or documentation."],
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Cancelled" }], details: { raw: null } };
      }
      const args = params as { path: string; line: number; character: number };
      let filePath = args.path.replace(/^@/, "");
      if (!filePath.startsWith("/")) {
        filePath = resolve(ctx.cwd, filePath);
      }
      const result = await getManager().request(filePath, "textDocument/hover", {
        textDocument: { uri: `file://${filePath}` },
        position: { line: args.line, character: args.character },
      });
      const formatted = await formatResult(result);
      return {
        content: [{ type: "text", text: formatted.text }],
        details: { raw: result, ...formatted.details },
      };
    },
  });

  pi.registerTool({
    name: "lsp_definition",
    label: "LSP Definition",
    description: "Go to definition via LSP",
    promptSnippet: "Jump to a symbol's definition",
    promptGuidelines: ["Use lsp_definition to find where a symbol is declared."],
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Cancelled" }], details: { raw: null } };
      }
      const args = params as { path: string; line: number; character: number };
      let filePath = args.path.replace(/^@/, "");
      if (!filePath.startsWith("/")) {
        filePath = resolve(ctx.cwd, filePath);
      }
      const result = await getManager().request(filePath, "textDocument/definition", {
        textDocument: { uri: `file://${filePath}` },
        position: { line: args.line, character: args.character },
      });
      const formatted = await formatResult(result);
      return {
        content: [{ type: "text", text: formatted.text }],
        details: { raw: result, ...formatted.details },
      };
    },
  });

  pi.registerTool({
    name: "lsp_references",
    label: "LSP References",
    description: "Find references to a symbol via LSP",
    promptSnippet: "Find all usages of a symbol",
    promptGuidelines: ["Use lsp_references before refactoring to understand blast radius."],
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
      includeDeclaration: Type.Optional(Type.Boolean({ default: true })),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Cancelled" }], details: { raw: null } };
      }
      const args = params as {
        path: string;
        line: number;
        character: number;
        includeDeclaration?: boolean;
      };
      let filePath = args.path.replace(/^@/, "");
      if (!filePath.startsWith("/")) {
        filePath = resolve(ctx.cwd, filePath);
      }
      const result = await getManager().request(filePath, "textDocument/references", {
        textDocument: { uri: `file://${filePath}` },
        position: { line: args.line, character: args.character },
        context: { includeDeclaration: args.includeDeclaration ?? true },
      });
      const formatted = await formatResult(result);
      return {
        content: [{ type: "text", text: formatted.text }],
        details: { raw: result, ...formatted.details },
      };
    },
  });

  pi.registerTool({
    name: "lsp_document_symbols",
    label: "LSP Document Symbols",
    description: "Get outline (functions, classes, variables) of a file",
    promptSnippet: "List symbols in a file",
    promptGuidelines: ["Use lsp_document_symbols to build a mental map of an unfamiliar file."],
    parameters: Type.Object({ path: Type.String() }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Cancelled" }], details: { raw: null } };
      }
      const args = params as { path: string };
      let filePath = args.path.replace(/^@/, "");
      if (!filePath.startsWith("/")) {
        filePath = resolve(ctx.cwd, filePath);
      }
      const result = await getManager().request(filePath, "textDocument/documentSymbol", {
        textDocument: { uri: `file://${filePath}` },
      });
      const formatted = await formatResult(result);
      return {
        content: [{ type: "text", text: formatted.text }],
        details: { raw: result, ...formatted.details },
      };
    },
  });

  pi.registerTool({
    name: "lsp_workspace_symbol",
    label: "LSP Workspace Symbol",
    description: "Search symbols across the entire workspace",
    promptSnippet: "Search symbols workspace-wide",
    promptGuidelines: ["Use lsp_workspace_symbol when you know a name but not its file."],
    parameters: Type.Object({ query: Type.String() }),
    async execute(_id, params, signal) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Cancelled" }], details: { raw: null } };
      }
      const args = params as { query: string };
      const result = await getManager().request(undefined, "workspace/symbol", {
        query: args.query,
      });
      const formatted = await formatResult(result);
      return {
        content: [{ type: "text", text: formatted.text }],
        details: { raw: result, ...formatted.details },
      };
    },
  });
}
