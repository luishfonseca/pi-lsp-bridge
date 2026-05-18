# pi-lsp-bridge

A config-driven Pi extension that connects language servers over stdio and exposes them as Pi tools.

## Requirements

- Pi coding agent
- Node.js
- Language server binaries installed on your PATH (e.g. `rust-analyzer`, `gopls`)

## Install

```bash
pi install npm:pi-lsp-bridge
```

Or add it to your project settings (`.pi/settings.json`):

```bash
pi install -l npm:pi-lsp-bridge
```

## Configuration

Create `.pi/lsp.json` in your project root, or `~/.pi/agent/lsp.json` for a global fallback.

```json
{
  "servers": {
    "rust": {
      "command": "rust-analyzer",
      "extension": "rs"
    },
    "go": {
      "command": "gopls",
      "extension": "go"
    },
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"],
      "extension": ["ts", "js", "tsx", "jsx"],
      "externalPatterns": ["**/node_modules/**"]
    }
  }
}
```

If no config is found, the extension loads but does nothing and shows a notice.

### `externalPatterns`

Each server entry may optionally include `externalPatterns`, an array of glob patterns (e.g. `**/node_modules/**`). Results from matching files are flagged as `(external)` in tool output. Tools that return locations also accept an `includeExternal` parameter — set it to `false` to hide external results entirely.

## Tools

The extension registers these tools when a valid config is present:

- `lsp_hover` — type/docs at cursor
- `lsp_definition` — go to definition
- `lsp_references` — find references
- `lsp_document_symbols` — file outline
- `lsp_workspace_symbol` — search symbols across workspace

The LLM calls them like any other tool. Results are returned as JSON.

## Reloading

Change your config and run `/reload`. Pi tears down the extension runtime and restarts it, which disconnects all language servers and reconnects them with the new config.

## Files

- `config.ts` — loads `.pi/lsp.json` or `~/.pi/agent/lsp.json`
- `manager.ts` — spawns server processes, manages connections, tracks open files
- `tools.ts` — Pi tool definitions
- `index.ts` — entry point, wires events
