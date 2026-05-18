import { mkdtemp, writeFile, readFile, access } from "node:fs/promises";
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

async function validatePosition(filePath: string, line: number, character: number) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");
  if (line < 0 || line >= lines.length) {
    throw new Error(
      `Line ${line} is out of bounds. File has ${lines.length} lines (valid: 0-${lines.length - 1}).`
    );
  }
  if (character < 0) {
    throw new Error(`Character ${character} is out of bounds. Must be >= 0.`);
  }
}

function normalizePath(input: string, cwd: string): string {
  let path = input.replace(/^@/, "");
  if (!path.startsWith("/")) {
    path = resolve(cwd, path);
  }
  return path;
}

const CANCELLED = {
  content: [{ type: "text" as const, text: "Cancelled" }],
  details: { raw: null },
};

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

async function lspRequest(
  mgr: LspManager,
  method: string,
  params: unknown,
  options: { filePath?: string; broadcast?: boolean }
) {
  let result: unknown;
  try {
    if (options.broadcast) {
      result = await mgr.requestAll(method, params);
    } else {
      result = await mgr.request(options.filePath, method, params);
    }
  } catch (err: any) {
    const msg = (err?.message ?? String(err)).replace(/^<semantic>\s*/, "").split("\n")[0];
    return {
      content: [{ type: "text" as const, text: `LSP error: ${msg}` }],
      details: { raw: null, error: err?.message },
    };
  }
  const formatted = await formatResult(result);
  return {
    content: [{ type: "text" as const, text: formatted.text }],
    details: { raw: result, ...formatted.details },
  };
}

export async function registerLspTools(pi: ExtensionAPI, getManager: () => LspManager) {
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
      if (signal?.aborted) return CANCELLED;
      const args = params as { path: string; line: number; character: number };
      const filePath = normalizePath(args.path, ctx.cwd);
      await validatePosition(filePath, args.line, args.character);
      return lspRequest(
        getManager(),
        "textDocument/hover",
        {
          textDocument: { uri: `file://${filePath}` },
          position: { line: args.line, character: args.character },
        },
        { filePath }
      );
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
      if (signal?.aborted) return CANCELLED;
      const args = params as { path: string; line: number; character: number };
      const filePath = normalizePath(args.path, ctx.cwd);
      await validatePosition(filePath, args.line, args.character);
      return lspRequest(
        getManager(),
        "textDocument/definition",
        {
          textDocument: { uri: `file://${filePath}` },
          position: { line: args.line, character: args.character },
        },
        { filePath }
      );
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
      if (signal?.aborted) return CANCELLED;
      const args = params as {
        path: string;
        line: number;
        character: number;
        includeDeclaration?: boolean;
      };
      const filePath = normalizePath(args.path, ctx.cwd);
      await validatePosition(filePath, args.line, args.character);
      return lspRequest(
        getManager(),
        "textDocument/references",
        {
          textDocument: { uri: `file://${filePath}` },
          position: { line: args.line, character: args.character },
          context: { includeDeclaration: args.includeDeclaration ?? true },
        },
        { filePath }
      );
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
      if (signal?.aborted) return CANCELLED;
      const args = params as { path: string };
      const filePath = normalizePath(args.path, ctx.cwd);
      return lspRequest(
        getManager(),
        "textDocument/documentSymbol",
        {
          textDocument: { uri: `file://${filePath}` },
        },
        { filePath }
      );
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
      if (signal?.aborted) return CANCELLED;
      const args = params as { query: string };
      return lspRequest(
        getManager(),
        "workspace/symbol",
        { query: args.query },
        {
          broadcast: true,
        }
      );
    },
  });
}
