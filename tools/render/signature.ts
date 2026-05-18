export async function renderSignatureHelp(result: any | null): Promise<string> {
  if (!result || !result.signatures || result.signatures.length === 0) {
    return "No signature help available.";
  }

  const { signatures, activeSignature = 0, activeParameter = 0 } = result;
  const sig = signatures[activeSignature] ?? signatures[0];

  let text = `\`\`\`\n${sig.label}\n\`\`\``;

  if (sig.parameters && sig.parameters.length > 0 && activeParameter < sig.parameters.length) {
    const param = sig.parameters[activeParameter];
    const paramLabel =
      typeof param.label === "string"
        ? param.label
        : sig.label.slice(param.label[0], param.label[1]);
    text += `\n\n**Parameter:** \`${paramLabel}\``;
    if (param.documentation) {
      const doc =
        typeof param.documentation === "string" ? param.documentation : param.documentation.value;
      text += `\n\n${doc}`;
    }
  }

  if (sig.documentation) {
    const doc = typeof sig.documentation === "string" ? sig.documentation : sig.documentation.value;
    text += `\n\n${doc}`;
  }

  return text;
}
