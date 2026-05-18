---
"pi-lsp-bridge": minor
---

Data-driven LSP tools via JSON presets

- Moved hardcoded tool definitions from `tools.ts` into `tools/full.json`.
- Added `preset` config option (defaults to `"full"`).
- Replaced `posParams()` and `mk()` helpers with a mapper engine (`MAPPERS`).
- `registerLspTools` is now `async` and loads presets at runtime.
- Fixed latent `workspace/symbol` bug where `undefined` path was passed to `mgr.request` — `workspaceSymbol` mapper correctly sets `needsFile: false`.
- `promptSnippet` and `promptGuidelines` are now first-class config fields, improving system prompt quality.
- Added `"tools"` to `package.json` `files` array so presets ship with the package.
