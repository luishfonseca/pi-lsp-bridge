---
"pi-lsp-bridge": patch
---

Fix tool output truncation to be actionable for the LLM. When an LSP response exceeds 50KB or 2000 lines, the full JSON is now written to a temp file and the tool result includes the path so the agent can read the complete output if needed. Also normalizes leading `@` in path arguments and resolves relative paths against cwd.
