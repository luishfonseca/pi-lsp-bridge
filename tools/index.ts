import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LspManager } from "../manager.js";
import { registerLspCallHierarchy } from "./call_hierarchy.js";
import { registerLspDeclaration } from "./declaration.js";
import { registerLspDefinition } from "./definition.js";
import { registerLspDocumentHighlight } from "./document_highlight.js";
import { registerLspDocumentSymbols } from "./document_symbols.js";
import { registerLspHover } from "./hover.js";
import { registerLspImplementation } from "./implementation.js";
import { registerLspInlayHint } from "./inlay_hint.js";
import { registerLspReferences } from "./references.js";
import { registerLspSignatureHelp } from "./signature_help.js";
import { registerLspTypeDefinition } from "./type_definition.js";
import { registerLspTypeHierarchy } from "./type_hierarchy.js";
import { registerLspWorkspaceSymbol } from "./workspace_symbol.js";

export async function registerLspTools(pi: ExtensionAPI, getManager: () => LspManager) {
  registerLspHover(pi, getManager);
  registerLspDefinition(pi, getManager);
  registerLspDeclaration(pi, getManager);
  registerLspTypeDefinition(pi, getManager);
  registerLspImplementation(pi, getManager);
  registerLspReferences(pi, getManager);
  registerLspDocumentSymbols(pi, getManager);
  registerLspWorkspaceSymbol(pi, getManager);
  registerLspSignatureHelp(pi, getManager);
  registerLspDocumentHighlight(pi, getManager);
  registerLspInlayHint(pi, getManager);
  registerLspCallHierarchy(pi, getManager);
  registerLspTypeHierarchy(pi, getManager);
}
