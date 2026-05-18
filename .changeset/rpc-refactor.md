---
"pi-lsp-bridge": minor
---

Replace `@lspeasy/client` and `@lspeasy/core` with raw `vscode-jsonrpc` and `vscode-languageserver-protocol`. Rewrite `LspManager` to use `MessageConnection` directly with proper `initialize`/`initialized`, `shutdown`/`exit` lifecycle, error/close handlers, and UI notifications. Add `requestAll()` for broadcasting requests to all configured servers.