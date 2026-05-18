import type { Range } from "vscode-languageserver-protocol";

export interface RenderContext {
  readSnippet?: (uri: string, range: Range) => Promise<string | undefined>;
  defaultUri?: string;
  language?: string;
  cwd: string;
  /** If provided, used to mark/filter results that come from outside the workspace */
  isExternal?: (uri: string) => boolean;
  /** When false and isExternal is set, external results are hidden */
  includeExternal?: boolean;
}
