---
"pi-lsp-bridge": minor
---

Remove the JSON preset tool engine. Tools are now registered explicitly in `tools.ts` instead of being loaded from `tools/*.json` via mapper definitions. Delete `tools/full.json` and `PLAN.md`.
