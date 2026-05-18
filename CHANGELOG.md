# pi-lsp-bridge

## 1.1.0

### Minor Changes

- 3f2c76d: Data-driven LSP tools via JSON presets
  - Moved hardcoded tool definitions from `tools.ts` into `tools/full.json`.
  - Added `preset` config option (defaults to `"full"`).
  - Replaced `posParams()` and `mk()` helpers with a mapper engine (`MAPPERS`).
  - `registerLspTools` is now `async` and loads presets at runtime.
  - Fixed latent `workspace/symbol` bug where `undefined` path was passed to `mgr.request` — `workspaceSymbol` mapper correctly sets `needsFile: false`.
  - `promptSnippet` and `promptGuidelines` are now first-class config fields, improving system prompt quality.
  - Added `"tools"` to `package.json` `files` array so presets ship with the package.

### Patch Changes

- 3d44825: Fix tool output truncation to be actionable for the LLM. When an LSP response exceeds 50KB or 2000 lines, the full JSON is now written to a temp file and the tool result includes the path so the agent can read the complete output if needed. Also normalizes leading `@` in path arguments and resolves relative paths against cwd.

## 1.0.3

### Patch Changes

- Add missing `camelcase` direct dependency used by `@lspeasy/client`

## 1.0.2

### Patch Changes

- 0f4818f: Migrate peer dependency from deprecated `@mariozechner/pi-coding-agent` to `@earendil-works/pi-coding-agent`
