import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { Range } from "vscode-languageserver-protocol";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import type { LspManager } from "./manager.js";
import {
  renderHover,
  renderLocations,
  renderDocumentSymbols,
  renderWorkspaceSymbols,
  type RenderContext,
} from "./render.js";

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

async function formatResult(text: string): Promise<{ text: string; details?: any }> {
  const t = truncateHead(text, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  if (!t.truncated) {
    return { text: t.content };
  }

  return {
    text:
      t.content +
      `\n\n[Output truncated: showing ${t.outputLines} of ${t.totalLines} lines ` +
      `(${formatSize(t.outputBytes)} of ${formatSize(t.totalBytes)}).]`,
    details: { truncation: t },
  };
}

async function resolvePosition(
  filePath: string,
  line: number,
  name?: string
): Promise<{ line: number; character: number }> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");
  const zeroBasedLine = line - 1;

  if (zeroBasedLine < 0 || zeroBasedLine >= lines.length) {
    throw new Error(
      `Line ${line} is out of bounds. File has ${lines.length} lines (valid: 1–${lines.length}).`
    );
  }

  const lineText = lines[zeroBasedLine];
  let character: number;

  if (name) {
    const idx = lineText.indexOf(name);
    if (idx !== -1) {
      character = idx;
    } else {
      throw new Error(`Name "${name}" not found on line ${line}.`);
    }
  } else {
    const match = lineText.match(/\S/);
    character = match ? match.index! : 0;
  }

  return { line: zeroBasedLine, character: Math.min(character, lineText.length) };
}

async function lspRequest<T>(
  mgr: LspManager,
  method: string,
  params: unknown,
  options: { filePath?: string; broadcast?: boolean; cwd: string },
  render: (result: T, ctx: RenderContext) => Promise<string>
) {
  let result: T;
  try {
    if (options.broadcast) {
      result = (await mgr.requestAll(method, params)) as T;
    } else {
      result = (await mgr.request(options.filePath, method, params)) as T;
    }
  } catch (err: any) {
    const rawMsg = err?.message ?? String(err);
    const category = rawMsg.includes("Server Error")
      ? "server_crash"
      : rawMsg.includes("No LSP server")
        ? "not_configured"
        : rawMsg.includes("not found")
          ? "not_found"
          : "request_failed";

    return {
      content: [{ type: "text" as const, text: `LSP ${method} failed: ${rawMsg}` }],
      details: { raw: err, category, method },
    };
  }

  const defaultUri = options.filePath ? `file://${options.filePath}` : undefined;

  const language = options.filePath ? mgr.resolveServerKey(options.filePath) : undefined;

  const fileCache = new Map<string, string>();

  const readSnippet = async (uri: string, range: Range): Promise<string | undefined> => {
    const filePath = uri.replace(/^file:\/\//, "");
    let text = fileCache.get(filePath);
    if (text === undefined) {
      try {
        text = await readFile(filePath, "utf8");
        fileCache.set(filePath, text);
      } catch {
        return undefined;
      }
    }
    const lines = text.split("\n");
    const start = Math.max(0, range.start.line);
    const end = Math.min(lines.length - 1, range.end.line);
    if (start > end) return undefined;
    return lines.slice(start, end + 1).join("\n");
  };

  const rendered = await render(result, { readSnippet, defaultUri, language, cwd: options.cwd });
  const formatted = await formatResult(rendered);

  return {
    content: [{ type: "text" as const, text: formatted.text }],
    details: { raw: result, ...formatted.details },
  };
}

// HACK: not really sure why this is needed
//
// I was getting a crash at startup because of a mismatch
// between the nix installed pi and the local npm package
// Once nix is also using earendil-works this can be removed
function makeMarkdownTheme(theme: any): MarkdownTheme {
  return {
    heading: (t: string) => theme.fg("mdHeading", t),
    link: (t: string) => theme.fg("mdLink", t),
    linkUrl: (t: string) => theme.fg("mdLinkUrl", t),
    code: (t: string) => theme.fg("mdCode", t),
    codeBlock: (t: string) => theme.fg("mdCodeBlock", t),
    codeBlockBorder: (t: string) => theme.fg("mdCodeBlockBorder", t),
    quote: (t: string) => theme.fg("mdQuote", t),
    quoteBorder: (t: string) => theme.fg("mdQuoteBorder", t),
    hr: (t: string) => theme.fg("mdHr", t),
    listBullet: (t: string) => theme.fg("mdListBullet", t),
    bold: (t: string) => theme.bold(t),
    italic: (t: string) => theme.italic(t),
    strikethrough: (t: string) => theme.strikethrough(t),
    underline: (t: string) => theme.underline(t),
  };
}

function lspRenderResult(
  result: { content?: Array<{ type: string; text?: string }> },
  _options: any,
  theme: any
) {
  const text = result.content?.find((c) => c.type === "text")?.text ?? "";
  return new Markdown(text, 0, 0, makeMarkdownTheme(theme));
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
      line: Type.Number({ description: "1-indexed line number" }),
      name: Type.Optional(
        Type.String({ description: "Symbol name that must appear literally on the given line" })
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as { path: string; line: number; name?: string };
      const filePath = normalizePath(args.path, ctx.cwd);
      const { line, character } = await resolvePosition(filePath, args.line, args.name);
      return lspRequest(
        getManager(),
        "textDocument/hover",
        {
          textDocument: { uri: `file://${filePath}` },
          position: { line, character },
        },
        { filePath, cwd: ctx.cwd },
        renderHover
      );
    },
    renderResult: lspRenderResult,
  });

  pi.registerTool({
    name: "lsp_definition",
    label: "LSP Definition",
    description: "Go to definition via LSP",
    promptSnippet: "Jump to a symbol's definition",
    promptGuidelines: ["Use lsp_definition to find where a symbol is declared."],
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number({ description: "1-indexed line number" }),
      name: Type.Optional(
        Type.String({ description: "Symbol name that must appear literally on the given line" })
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as { path: string; line: number; name?: string };
      const filePath = normalizePath(args.path, ctx.cwd);
      const { line, character } = await resolvePosition(filePath, args.line, args.name);
      return lspRequest(
        getManager(),
        "textDocument/definition",
        {
          textDocument: { uri: `file://${filePath}` },
          position: { line, character },
        },
        { filePath, cwd: ctx.cwd },
        renderLocations
      );
    },
    renderResult: lspRenderResult,
  });

  pi.registerTool({
    name: "lsp_references",
    label: "LSP References",
    description: "Find references to a symbol via LSP",
    promptSnippet: "Find all usages of a symbol",
    promptGuidelines: ["Use lsp_references before refactoring to understand blast radius."],
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number({ description: "1-indexed line number" }),
      name: Type.Optional(
        Type.String({ description: "Symbol name that must appear literally on the given line" })
      ),
      includeDeclaration: Type.Optional(Type.Boolean({ default: true })),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as {
        path: string;
        line: number;
        name?: string;
        includeDeclaration?: boolean;
      };
      const filePath = normalizePath(args.path, ctx.cwd);
      const { line, character } = await resolvePosition(filePath, args.line, args.name);
      return lspRequest(
        getManager(),
        "textDocument/references",
        {
          textDocument: { uri: `file://${filePath}` },
          position: { line, character },
          context: { includeDeclaration: args.includeDeclaration ?? true },
        },
        { filePath, cwd: ctx.cwd },
        renderLocations
      );
    },
    renderResult: lspRenderResult,
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
        { filePath, cwd: ctx.cwd },
        renderDocumentSymbols
      );
    },
    renderResult: lspRenderResult,
  });

  pi.registerTool({
    name: "lsp_workspace_symbol",
    label: "LSP Workspace Symbol",
    description: "Search symbols across the entire workspace",
    promptSnippet: "Search symbols workspace-wide",
    promptGuidelines: ["Use lsp_workspace_symbol when you know a name but not its file."],
    parameters: Type.Object({ query: Type.String() }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) return CANCELLED;
      const args = params as { query: string };
      return lspRequest(
        getManager(),
        "workspace/symbol",
        { query: args.query },
        { broadcast: true, cwd: ctx.cwd },
        renderWorkspaceSymbols
      );
    },
    renderResult: lspRenderResult,
  });
}
