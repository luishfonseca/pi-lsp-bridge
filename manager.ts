import { spawn, ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { LSPClient } from "@lspeasy/client";
import { StdioTransport } from "@lspeasy/core/node";
import type { LspConfig } from "./config.js";

type Connection = {
  process: ChildProcess;
  client: LSPClient;
  openFiles: Set<string>; // uris
};

export class LspManager {
  private clients = new Map<string, Connection>(); // key = rootUri + "|" + serverKey
  constructor(
    private config: LspConfig,
    private rootUri: string
  ) {}

  private key(serverKey: string) {
    return `${this.rootUri}|${serverKey}`;
  }

  private resolveServerKey(filePath: string): string | undefined {
    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    return this.config.extMap[ext];
  }

  private async ensureClient(serverKey: string): Promise<LSPClient> {
    const k = this.key(serverKey);
    const existing = this.clients.get(k);
    if (existing) return existing.client;

    const cfg = this.config.servers[serverKey];
    if (!cfg) throw new Error(`No LSP server configured for "${serverKey}"`);

    const proc = spawn(cfg.command, cfg.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const transport = new StdioTransport({
      input: proc.stdout!,
      output: proc.stdin!,
    });

    const client = new LSPClient({ name: "pi-lsp-bridge", version: "1.0.0" });
    await client.connect(transport);

    this.clients.set(k, { process: proc, client, openFiles: new Set() });
    return client;
  }

  private async ensureOpen(filePath: string, serverKey: string) {
    const client = await this.ensureClient(serverKey);
    const uri = `file://${filePath}`;
    const k = this.key(serverKey);
    const conn = this.clients.get(k)!;
    if (conn.openFiles.has(uri)) return client;

    const text = await readFile(filePath, "utf8");
    await client.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: serverKey, version: 1, text },
    });
    conn.openFiles.add(uri);
    return client;
  }

  /** Make an LSP request after ensuring the file is open */
  async request<T>(filePath: string, method: string, params: unknown): Promise<T> {
    const serverKey = this.resolveServerKey(filePath);
    if (!serverKey) throw new Error(`No LSP server mapped for ${filePath}`);

    await this.ensureOpen(filePath, serverKey);
    const client = await this.ensureClient(serverKey);

    return (await client.sendRequest(method as any, params)) as T;
  }

  async disconnectAll() {
    for (const [, { client, process }] of this.clients) {
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
      if (!process.killed) process.kill();
    }
    this.clients.clear();
  }
}
