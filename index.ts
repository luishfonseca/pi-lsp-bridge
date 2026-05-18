import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./config.js";
import { LspManager } from "./manager.js";
import { registerLspTools } from "./tools/index.js";

export default async function (pi: ExtensionAPI) {
  let manager: LspManager | undefined;

  pi.on("session_start", async (_event, ctx) => {
    const config = await loadConfig(ctx.cwd);

    if (!config) {
      ctx.ui.notify(
        "LSP bridge: no config found. Create .pi/lsp.json or ~/.pi/agent/lsp.json",
        "warning"
      );
      return;
    }

    manager = new LspManager(config, `file://${ctx.cwd}`, ctx.ui.notify.bind(ctx.ui));

    const getManager = () => {
      if (!manager) throw new Error("LSP manager not initialized");
      return manager;
    };

    await registerLspTools(pi, getManager);
  });

  pi.on("session_shutdown", async () => {
    await manager?.disconnectAll();
    manager = undefined;
  });

  // `/reload` is handled automatically: pi tears down the extension runtime
  // (triggering session_shutdown → disconnectAll) and restarts it (triggering
  // session_start → fresh LspManager with latest config). No extra command needed.
}
