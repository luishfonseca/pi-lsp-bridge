---
"pi-lsp-bridge": minor
---

Add fuzzy name matching for position-based LSP tools

When a symbol name is not found on the exact line provided, the tool now falls back to the nearest match within a ±10 line window. Exact substring matches are preferred over case-insensitive matches, and closer matches win on ties. A clear warning is included in the response when fuzzy matching is used, and structured metadata is available in `result.details.fuzzy`.

Tools affected: `lsp_hover`, `lsp_definition`, `lsp_declaration`, `lsp_type_definition`, `lsp_implementation`, `lsp_references`, `lsp_document_highlight`, `lsp_signature_help`, `lsp_call_hierarchy`, `lsp_type_hierarchy`, `lsp_inlay_hint`, and `lsp_document_symbols` (via `resolveRange`).
