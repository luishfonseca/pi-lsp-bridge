---
"pi-lsp-bridge": minor
---

Refactor into modular `tools/` directory and add 8 new LSP tools

Replaced monolithic `tools.ts` and `render.ts` with a modular `tools/` layout:
- Individual tool files under `tools/*.ts`
- Shared utilities under `tools/utils/`
- Renderers under `tools/render/`

New tools added:
- `lsp_declaration` — go to declaration
- `lsp_type_definition` — go to type definition
- `lsp_implementation` — find implementations
- `lsp_signature_help` — signature help at call sites
- `lsp_document_highlight` — highlight all occurrences in file
- `lsp_inlay_hint` — show inferred types and parameter names inline
- `lsp_call_hierarchy` — explore incoming/outgoing calls
- `lsp_type_hierarchy` — find supertypes or subtypes

Also updated `tsconfig.json` to include `"**/*.ts"` and adjusted package exports and scripts for the new directory structure.
