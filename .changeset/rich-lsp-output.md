---
"pi-lsp-bridge": minor
---

Enhance LSP tools with richer output and name-based position resolution

- Replace manual `character` parameter with optional `name` for hover, definition, and references tools; character is auto-resolved from the line content
- Add post-processing that resolves numeric LSP symbol kinds to human-readable names
- Convert `Range` objects into formatted location strings with inline code snippets
- Categorize LSP errors (server_crash, not_configured, not_found, request_failed)
- Add `vscode-languageserver-textdocument` dependency for accurate snippet extraction
