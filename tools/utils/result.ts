import { Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";

function makeMarkdownTheme(theme: any): MarkdownTheme {
  return {
    heading: (t: string) => theme.fg("mdHeading", t),
    link: (t: string) => theme.fg("mdLink", t),
    linkUrl: (t: string) => theme.fg("mdLinkUrl", t),
    code: (t: string) => theme.fg("mdCode", t),
    codeBlock: (t: string) => theme.fg("mdCodeBlock", t),
    codeBlockBorder: (t: string) => theme.fg("mdCodeBlockBorder", t),
    quote: (t: string) => theme.fg("mdQuote", t),
    quoteBorder: (t: string) => theme.fg("mdQuoteBorder", t),
    hr: (t: string) => theme.fg("mdHr", t),
    listBullet: (t: string) => theme.fg("mdListBullet", t),
    bold: (t: string) => theme.bold(t),
    italic: (t: string) => theme.italic(t),
    strikethrough: (t: string) => theme.strikethrough(t),
    underline: (t: string) => theme.underline(t),
  };
}

export function lspRenderResult(
  result: { content?: Array<{ type: string; text?: string }> },
  _options: any,
  theme: any
) {
  const text = result.content?.find((c) => c.type === "text")?.text ?? "";
  return new Markdown(text, 0, 0, makeMarkdownTheme(theme));
}
