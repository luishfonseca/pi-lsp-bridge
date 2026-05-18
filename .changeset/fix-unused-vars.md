---
"pi-lsp-bridge": patch
---

Remove unused variables to fix lint errors

- Drop unused `k` from `for...of` loop in `manager.ts`
- Remove unused `_preset` parameter from `registerLspTools` in `tools.ts` (and its caller in `index.ts`)
