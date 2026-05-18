import type { LspManager } from "../../manager.js";
import type { RenderContext } from "./types.js";
import { createSnippetReader } from "./snippets.js";
import { formatResult } from "./format.js";

export async function lspRequest<T>(
  mgr: LspManager,
  method: string,
  params: unknown,
  options: { filePath?: string; broadcast?: boolean; cwd: string; includeExternal?: boolean },
  render: (result: T, ctx: RenderContext) => Promise<string>
) {
  let result: T;
  try {
    if (options.broadcast) {
      result = (await mgr.requestAll(method, params)) as T;
    } else {
      result = (await mgr.request(options.filePath, method, params)) as T;
    }
  } catch (err: any) {
    const rawMsg = err?.message ?? String(err);
    const category = rawMsg.includes("Server Error")
      ? "server_crash"
      : rawMsg.includes("No LSP server")
        ? "not_configured"
        : rawMsg.includes("not found")
          ? "not_found"
          : "request_failed";

    return {
      content: [{ type: "text" as const, text: `LSP ${method} failed: ${rawMsg}` }],
      details: { raw: err, category, method },
    };
  }

  const defaultUri = options.filePath ? `file://${options.filePath}` : undefined;
  const language = options.filePath ? mgr.resolveServerKey(options.filePath) : undefined;
  const readSnippet = createSnippetReader();

  const rendered = await render(result, {
    readSnippet,
    defaultUri,
    language,
    cwd: options.cwd,
    isExternal: (uri) => mgr.isExternal(uri),
    includeExternal: options.includeExternal,
  });
  const formatted = await formatResult(rendered);

  return {
    content: [{ type: "text" as const, text: formatted.text }],
    details: { raw: result, ...formatted.details },
  };
}

export async function lspTwoStepRequest<TPrepare, TResult>(
  mgr: LspManager,
  prepareMethod: string,
  prepareParams: unknown,
  followUpMethod: string,
  followUpParamsBuilder: (items: TPrepare[]) => unknown[],
  options: { filePath: string; cwd: string; includeExternal?: boolean },
  render: (results: TResult[], ctx: RenderContext) => Promise<string>
) {
  let prepareResult: TPrepare[];
  try {
    const raw = (await mgr.request(options.filePath, prepareMethod, prepareParams)) as
      | TPrepare[]
      | TPrepare
      | null;
    if (Array.isArray(raw)) {
      prepareResult = raw;
    } else if (raw) {
      prepareResult = [raw];
    } else {
      prepareResult = [];
    }
  } catch (err: any) {
    const rawMsg = err?.message ?? String(err);
    return {
      content: [{ type: "text" as const, text: `LSP ${prepareMethod} failed: ${rawMsg}` }],
      details: { raw: err, category: "request_failed", method: prepareMethod },
    };
  }

  const allResults: TResult[] = [];
  const paramSets = followUpParamsBuilder(prepareResult);
  for (const params of paramSets) {
    try {
      const raw = (await mgr.request(options.filePath, followUpMethod, params)) as
        | TResult[]
        | TResult
        | null;
      if (Array.isArray(raw)) {
        allResults.push(...raw);
      } else if (raw) {
        allResults.push(raw);
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      mgr.notifyUser(`LSP ${followUpMethod} partial failure: ${msg}`, "warning");
    }
  }

  const defaultUri = `file://${options.filePath}`;
  const language = mgr.resolveServerKey(options.filePath);
  const readSnippet = createSnippetReader();

  const rendered = await render(allResults, {
    readSnippet,
    defaultUri,
    language,
    cwd: options.cwd,
    isExternal: (uri) => mgr.isExternal(uri),
    includeExternal: options.includeExternal,
  });
  const formatted = await formatResult(rendered);

  return {
    content: [{ type: "text" as const, text: formatted.text }],
    details: { raw: allResults, ...formatted.details },
  };
}
