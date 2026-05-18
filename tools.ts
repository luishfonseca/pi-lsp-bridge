import { mkdtemp, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { Type } from "typebox";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { Range } from "vscode-languageserver-protocol";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import type { LspManager } from "./manager.js";

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

// ─── Position resolution ───────────────────────────────────────────

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

  if (line < 0 || line >= lines.length) {
    throw new Error(
      `Line ${line} is out of bounds. File has ${lines.length} lines (valid: 0-${lines.length - 1}).`
    );
  }

  const lineText = lines[line];
  let character: number;

  if (name) {
    const idx = lineText.indexOf(name);
    if (idx !== -1) {
      character = idx;
    } else {
      const match = lineText.match(/\S/);
      character = match ? match.index! : 0;
    }
  } else {
    const match = lineText.match(/\S/);
    character = match ? match.index! : 0;
  }

  return { line, character: Math.min(character, lineText.length) };
}

// ─── Post-processing helpers ───────────────────────────────────────

const symbolKindNames: Record<number, string> = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter",
};

function resolveKinds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(resolveKinds);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "kind" && typeof v === "number") {
        result[k] = symbolKindNames[v] ?? v;
      } else {
        result[k] = resolveKinds(v);
      }
    }
    return result;
  }
  return value;
}

function formatRange(range: Range): string {
  const { start, end } = range;
  if (start.line === end.line) {
    if (start.character === end.character) {
      return `${start.line}:${start.character}`;
    }
    return `${start.line}:${start.character}–${end.character}`;
  }
  return `${start.line}:${start.character}–${end.line}:${end.character}`;
}

function isRange(value: unknown): value is Range {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const start = obj.start;
  const end = obj.end;
  if (!start || !end || typeof start !== "object" || typeof end !== "object") return false;
  const s = start as Record<string, unknown>;
  const e = end as Record<string, unknown>;
  return (
    typeof s.line === "number" &&
    typeof s.character === "number" &&
    typeof e.line === "number" &&
    typeof e.character === "number"
  );
}

function extractUri(obj: Record<string, unknown>): string | undefined {
  if (typeof obj.uri === "string") return obj.uri;
  if (obj.location && typeof obj.location === "object") {
    const loc = obj.location as Record<string, unknown>;
    if (typeof loc.uri === "string") return loc.uri;
  }
  return undefined;
}

async function resolveRanges(
  value: unknown,
  readSnippet: (uri: string, range: Range) => Promise<string | undefined>,
  uri?: string
): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => resolveRanges(v, readSnippet, uri)));
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nextUri = extractUri(obj) ?? uri;

    if (isRange(obj)) {
      const snippet = nextUri ? await readSnippet(nextUri, obj) : undefined;
      const result: Record<string, unknown> = {
        location: formatRange(obj),
      };
      if (snippet !== undefined) {
        result.snippet = snippet;
      }
      return result;
    }

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = await resolveRanges(v, readSnippet, nextUri);
    }
    return result;
  }

  return value;
}

// ─── LSP request wrapper ───────────────────────────────────────────

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

  const withKinds = resolveKinds(result);
  const defaultUri = options.filePath ? `file://${options.filePath}` : undefined;
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
    const doc = TextDocument.create(uri, "plaintext", 1, text);
    return doc.getText(range);
  };

  const transformed = await resolveRanges(withKinds, readSnippet, defaultUri);
  const formatted = await formatResult(transformed);

  return {
    content: [{ type: "text" as const, text: formatted.text }],
    details: { raw: result, ...formatted.details },
  };
}

// ─── Tool registration ─────────────────────────────────────────────

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
      name: Type.Optional(Type.String()),
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
      name: Type.Optional(Type.String()),
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
      name: Type.Optional(Type.String()),
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
