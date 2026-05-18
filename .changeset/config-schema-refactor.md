---
"pi-lsp-bridge": major
---

Move extension mapping into server config

BREAKING CHANGE: the top-level `extMap` field has been removed from `LspConfig`. Each server entry now accepts an `extension` field (string or string array) that declares which file extensions it handles. `LspManager.resolveServerKey` iterates the server definitions at runtime to find a match.
