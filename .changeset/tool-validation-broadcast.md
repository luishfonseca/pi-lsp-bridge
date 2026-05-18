---
"pi-lsp-bridge": minor
---

Add `validatePosition` to check file existence and line/character bounds before LSP requests. Add `normalizePath` for consistent `@` prefix and relative path handling. Add `lspRequest` helper with centralized error formatting. Broadcast `workspace/symbol` queries across all configured servers via `requestAll()` and merge results.
