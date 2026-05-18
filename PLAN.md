# Plan: Data-Driven LSP Tools

## Goal
Move the hardcoded tool definitions out of `tools.ts` and into JSON preset files under `tools/`.

## Why
- Adding a tool means editing JSON — no TypeScript rebuild, no copy-paste boilerplate.
- `tools.ts` shrinks from ~80 lines of repetitive `mk()` calls to ~30 lines of mapper definitions + a 10-line loop.
- The `posParams()` helper and `mk()` closure disappear entirely.
- `promptSnippet` and `promptGuidelines` move from "not set" to first-class config fields.
- A latent bug in `workspace/symbol` (undefined `args.path` passed to `mgr.request`) gets fixed naturally because mappers declare whether they need a file.

## Changes

### 1. New `tools/` directory
Create `tools/full.json` with the current 5 tools:

```json
[
  {
    "name": "lsp_hover",
    "label": "LSP Hover",
    "method": "textDocument/hover",
    "mapper": "textDocumentPosition",
    "description": "Get hover information (types, docs) from the language server",
    "promptSnippet": "Get type/docs info at a file position",
    "promptGuidelines": ["Use lsp_hover when you need to verify a symbol's type or documentation."]
  },
  {
    "name": "lsp_definition",
    "label": "LSP Definition",
    "method": "textDocument/definition",
    "mapper": "textDocumentPosition",
    "description": "Go to definition via LSP",
    "promptSnippet": "Jump to a symbol's definition",
    "promptGuidelines": ["Use lsp_definition to find where a symbol is declared."]
  },
  {
    "name": "lsp_references",
    "label": "LSP References",
    "method": "textDocument/references",
    "mapper": "textDocumentPositionContext",
    "description": "Find references to a symbol via LSP",
    "promptSnippet": "Find all usages of a symbol",
    "promptGuidelines": ["Use lsp_references before refactoring to understand blast radius."]
  },
  {
    "name": "lsp_document_symbols",
    "label": "LSP Document Symbols",
    "method": "textDocument/documentSymbol",
    "mapper": "textDocument",
    "description": "Get outline (functions, classes, variables) of a file",
    "promptSnippet": "List symbols in a file",
    "promptGuidelines": ["Use lsp_document_symbols to build a mental map of an unfamiliar file."]
  },
  {
    "name": "lsp_workspace_symbol",
    "label": "LSP Workspace Symbol",
    "method": "workspace/symbol",
    "mapper": "workspaceSymbol",
    "description": "Search symbols across the entire workspace",
    "promptSnippet": "Search symbols workspace-wide",
    "promptGuidelines": ["Use lsp_workspace_symbol when you know a name but not its file."]
  }
]
```

### 2. `config.ts` — add `preset`

```typescript
export type LspConfig = {
  extMap: Record<string, string>;
  servers: Record<string, ServerConfig>;
  preset?: string; // "full" if omitted
};
```

### 3. `tools.ts` — replace hardcoded tools with mapper engine

Remove:
- `posParams()`
- `mk()`
- All 5 `mk(...)` calls

Add a `MAPPERS` record. Each mapper provides:
- `parameters` — a Typebox schema (minimal LLM-facing args)
- `buildParams(args)` — transforms tool args → LSP params
- `needsFile: boolean` — whether `mgr.request` needs a file path

Mapper names are derived from LSP param type names (TextDocumentPositionParams, ReferenceParams, etc.). We only maintain the small Typebox schemas for the LLM-facing args; the full LSP param shapes are already in `@lspeasy/core` as Zod schemas.

```typescript
const MAPPERS = {
  textDocument: {
    needsFile: true,
    parameters: Type.Object({ path: Type.String() }),
    buildParams: (p: any) => ({ textDocument: { uri: `file://${p.path}` } }),
  },
  textDocumentPosition: {
    needsFile: true,
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
    }),
    buildParams: (p: any) => ({
      textDocument: { uri: `file://${p.path}` },
      position: { line: p.line, character: p.character },
    }),
  },
  textDocumentPositionContext: {
    needsFile: true,
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
      includeDeclaration: Type.Optional(Type.Boolean({ default: true })),
    }),
    buildParams: (p: any) => ({
      textDocument: { uri: `file://${p.path}` },
      position: { line: p.line, character: p.character },
      context: { includeDeclaration: p.includeDeclaration ?? true },
    }),
  },
  workspaceSymbol: {
    needsFile: false,
    parameters: Type.Object({ query: Type.String() }),
    buildParams: (p: any) => ({ query: p.query }),
  },
};
```

`registerLspTools` becomes `async` and loads the preset:

export async function registerLspTools(
  pi: ExtensionAPI,
  getManager: () => LspManager,
  preset?: string
) {
  const name = preset ?? "full";
  const here = fileURLToPath(new URL(".", import.meta.url));
  const base = here.endsWith("/dist/") ? resolve(here, "..") : here;
  const file = resolve(base, "tools", `${name}.json`);
  const defs = JSON.parse(await readFile(file, "utf8"));
  for (const def of defs) {
    const mapper = (MAPPERS as any)[def.mapper];
    if (!mapper) throw new Error(`Unknown mapper "${def.mapper}" in ${def.name}`);

    pi.registerTool({
      name: def.name,
      label: def.label,
      description: def.description,
      promptSnippet: def.promptSnippet,
      promptGuidelines: def.promptGuidelines,
      parameters: mapper.parameters,
      async execute(_id, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) {
          return { content: [{ type: "text", text: "Cancelled" }], details: { raw: null } };
        }
        const mgr = getManager();
        const args = params as Record<string, any>;
        let filePath = mapper.needsFile ? args.path : undefined;
        if (typeof filePath === "string") {
          filePath = filePath.replace(/^@/, "");
          if (!filePath.startsWith("/")) {
            filePath = resolve(ctx.cwd, filePath);
          }
        }
        const normalizedArgs = { ...args, path: filePath };
        const result = await mgr.request(filePath, def.method, mapper.buildParams(normalizedArgs));
        return {
          content: [{ type: "text", text: formatResult(result) }],
          details: { raw: result },
        };
      },
    });
  }
}
```

> **Preservation of output truncation:** `formatResult` must continue to use `truncateHead` with `DEFAULT_MAX_BYTES` / `DEFAULT_MAX_LINES`. LSP responses (especially `workspace/symbol` and `references`) can exceed 50 KB.

### 4. `manager.ts` — tolerate workspace methods

Change `request` to accept an optional `filePath`. When omitted, use the first configured server and skip `ensureOpen`.

```typescript
async request<T>(filePath: string | undefined, method: string, params: unknown): Promise<T> {
  let serverKey: string | undefined;

  if (filePath) {
    serverKey = this.resolveServerKey(filePath);
    if (!serverKey) throw new Error(`No LSP server mapped for ${filePath}`);
    await this.ensureOpen(filePath, serverKey);
  } else {
    serverKey = Object.keys(this.config.servers)[0];
    if (!serverKey) throw new Error(`No LSP servers configured`);
  }

  const client = await this.ensureClient(serverKey);
  return (await client.sendRequest(method as any, params)) as T;
}
```

### 5. `index.ts` — pass preset

```typescript
await registerLspTools(pi, getManager, config.preset);
```

### 6. `package.json` — ship presets

Add `"tools"` to the `files` array so presets are included in the npm package.

Also ensure the `pi` manifest points to the built entry point and source `.ts` files are excluded:

```json
{
  "pi": {
    "extensions": ["./dist/index.js"]
  },
  "files": ["dist", "tools", "README.md", "LICENSE"]
}
```

## Mapper names and future extension

| Mapper | LSP origin | Covered methods |
|--------|-----------|-----------------|
| `textDocument` | `DocumentSymbolParams` | `documentSymbol`, `codeLens`, `documentLink`, `foldingRange` |
| `textDocumentPosition` | `TextDocumentPositionParams` | `hover`, `definition`, `declaration`, `typeDefinition`, `implementation`, `signatureHelp`, `documentHighlight`, `prepareCallHierarchy`, `prepareTypeHierarchy` |
| `textDocumentPositionContext` | `ReferenceParams` | `references` |
| `workspaceSymbol` | `WorkspaceSymbolParams` | `workspace/symbol` |

Future mappers (out of scope):
- `textDocumentPositionCompletion` — `CompletionParams` (`completion`; context shape differs from `ReferenceParams`)
- `textDocumentFormat` — `DocumentFormattingParams` (`formatting`; requires `options: { tabSize, insertSpaces }`)
- `textDocumentDiagnostic` — `DocumentDiagnosticParams` (`diagnostic`; optional `identifier` and `previousResultId`)
- `textDocumentRange` — `DocumentRangeFormattingParams` (`rangeFormatting`, `inlayHint`, `semanticTokens/range`, `inlineValue`)
- `textDocumentPositionNewName` — `RenameParams` (`rename`)
- `item` — `CallHierarchyIncomingCallsParams` (`callHierarchy/incomingCalls`, `callHierarchy/outgoingCalls`, `typeHierarchy/supertypes`, `typeHierarchy/subtypes`)

## Simplification summary

| Before | After |
|--------|-------|
| `posParams()` helper + property spreading | One `textDocumentPosition` mapper entry |
| `mk()` helper + 5 hardcoded calls | One JSON array + one loop |
| `workspace/symbol` passes `undefined` path and crashes | `workspaceSymbol` mapper sets `needsFile: false`; manager handles it |
| `promptSnippet` / `promptGuidelines` not set | First-class JSON fields, improving system prompt quality |
| Adding a tool = edit TS + rebuild | Adding a tool = edit JSON, `/reload` |
| Invented mapper names (`position`, `document`) | LSP-derived names anyone reading the spec recognizes |
| Maintaining full param shapes | Only maintain minimal LLM-facing Typebox schemas; full LSP shapes live in `@lspeasy/core` |

## Future extension points (out of scope)

- Custom preset paths: `preset: "./my-tools.json"`.
- Additional mappers: `textDocumentRange`, `textDocumentPositionNewName`, `item`.
- Per-tool passthrough fields (e.g., `context` overrides) without new mappers.
- `prepareArguments` shims on mappers for forward compatibility when preset schemas evolve.
