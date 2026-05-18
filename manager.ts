import { spawn, ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import * as rpc from "vscode-jsonrpc/lib/node/main.js";

import { minimatch } from "minimatch";
import type { LspConfig } from "./config.js";

type Connection = {
  process: ChildProcess;
  connection: rpc.MessageConnection;
  openFiles: Set<string>; // uris
};

export class LspManager {
  private clients = new Map<string, Connection>(); // key = rootUri + "|" + serverKey
  constructor(
    private config: LspConfig,
    private rootUri: string,
    private notify: (message: string, level?: "info" | "warning" | "error") => void
  ) {}

  private key(serverKey: string) {
    return `${this.rootUri}|${serverKey}`;
  }

  resolveServerKey(filePath: string): string | undefined {
    const idx = filePath.lastIndexOf(".");
    if (idx < 0) return undefined;
    const ext = filePath.slice(idx + 1).toLowerCase();
    for (const [serverKey, cfg] of Object.entries(this.config.servers)) {
      const extensions = Array.isArray(cfg.extension)
        ? cfg.extension
        : cfg.extension
          ? [cfg.extension]
          : [];
      if (extensions.includes(ext)) {
        return serverKey;
      }
    }
    return undefined;
  }

  private async ensureClient(serverKey: string): Promise<rpc.MessageConnection> {
    const k = this.key(serverKey);
    const existing = this.clients.get(k);
    if (existing) return existing.connection;

    const cfg = this.config.servers[serverKey];
    if (!cfg) throw new Error(`No LSP server configured for "${serverKey}"`);

    const proc = spawn(cfg.command, cfg.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(proc.stdout!),
      new rpc.StreamMessageWriter(proc.stdin!)
    );

    connection.onError(([err]) => {
      this.notify(`LSP server ${serverKey} error: ${err.message}`, "error");
    });

    connection.onClose(() => {
      this.clients.delete(k);
      if (!proc.killed) proc.kill();
    });

    connection.listen();

    await connection.sendRequest("initialize", {
      processId: process.pid,
      clientInfo: { name: "pi-lsp-bridge", version: "1.0.0" },
      capabilities: {},
      rootUri: this.rootUri,
      workspaceFolders: [{ uri: this.rootUri, name: "workspace" }],
    });

    connection.sendNotification("initialized", {});

    this.clients.set(k, { process: proc, connection, openFiles: new Set() });
    return connection;
  }

  private async ensureOpen(filePath: string, serverKey: string) {
    const connection = await this.ensureClient(serverKey);
    const uri = `file://${filePath}`;
    const k = this.key(serverKey);
    const conn = this.clients.get(k)!;
    if (conn.openFiles.has(uri)) return connection;

    const text = await readFile(filePath, "utf8");
    connection.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: serverKey, version: 1, text },
    });
    conn.openFiles.add(uri);
    return connection;
  }

  /** Broadcast an LSP request to every configured server and flatten array results */
  async requestAll<T>(method: string, params: unknown): Promise<T[]> {
    const all: T[] = [];
    for (const serverKey of Object.keys(this.config.servers)) {
      try {
        const connection = await this.ensureClient(serverKey);
        const result = (await connection.sendRequest(method, params)) as T[] | null;
        if (Array.isArray(result)) all.push(...result);
      } catch {
        // ignore servers that error or have no project open
      }
    }
    return all;
  }

  /** Make an LSP request after ensuring the file is open */
  async request<T>(filePath: string | undefined, method: string, params: unknown): Promise<T> {
    let serverKey: string | undefined;

    if (filePath) {
      serverKey = this.resolveServerKey(filePath);
      if (!serverKey) throw new Error(`No LSP server mapped for ${filePath}`);
      await this.ensureOpen(filePath, serverKey);
    } else {
      serverKey = Object.keys(this.config.servers)[0];
      if (!serverKey) throw new Error(`No LSP servers configured`);
    }

    const connection = await this.ensureClient(serverKey);
    return (await connection.sendRequest(method, params)) as T;
  }

  /** Check whether a URI points to an external (non-workspace) file */
  isExternal(uri: string): boolean {
    const absPath = uri.replace(/^file:\/\//, "");
    const rootPath = this.rootUri.replace(/^file:\/\//, "");

    // Tier 1: outside workspace
    const isOutside = !(absPath === rootPath || absPath.startsWith(rootPath + "/"));
    if (isOutside) return true;

    // Tier 2: matches external patterns for the relevant server(s)
    const serverKey = this.resolveServerKey(absPath);
    const serversToCheck = serverKey ? [serverKey] : Object.keys(this.config.servers);

    for (const sk of serversToCheck) {
      const patterns = this.config.servers[sk]?.externalPatterns;
      if (!patterns) continue;
      for (const pattern of patterns) {
        if (minimatch(absPath, pattern)) return true;
      }
    }
    return false;
  }

  notifyUser(message: string, level?: "info" | "warning" | "error") {
    this.notify(message, level);
  }

  async disconnectAll() {
    for (const [, { connection, process }] of this.clients) {
      try {
        await connection.sendRequest("shutdown");
        await connection.sendNotification("exit");
      } catch {
        // best effort — process may have already exited
      }
      connection.dispose();
      try {
        process.kill();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}
