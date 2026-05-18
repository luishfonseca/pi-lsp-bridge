---
"pi-lsp-bridge": minor
---

Add external file detection with `externalPatterns` config and `includeExternal` tool parameter

- New `externalPatterns?: string[]` per server in `lsp.json` (glob matching via `minimatch`)
- New `includeExternal?: boolean` parameter on location-based tools (`lsp_definition`, `lsp_declaration`, `lsp_type_definition`, `lsp_implementation`, `lsp_references`, `lsp_call_hierarchy`, `lsp_type_hierarchy`, `lsp_workspace_symbol`)
- When `includeExternal` is not explicitly `false`, external results are flagged with `\`(external)\``
- When `includeExternal: false`, external results are hidden entirely
- Two-tier detection: files outside the workspace root are always external; files inside the workspace matching `externalPatterns` are also external
