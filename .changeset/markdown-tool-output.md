---
"pi-lsp-bridge": minor
---

Render LSP tool results as markdown with TUI support

LSP tool responses are now rendered as human-readable markdown instead
of raw JSON. A new `render.ts` module handles formatting for hover,
definition, references, document symbols, and workspace symbols.

- Remove `vscode-languageserver-textdocument` dependency; snippet
  extraction now uses simple line splitting.
- Add `renderResult` to all LSP tools for styled TUI output via
  `@earendil-works/pi-tui`.
- Switch tool `line` parameters to 1-indexed (internally converted to
  0-indexed for LSP).
- Truncated output no longer writes temporary files.
