import { readFile, access } from "node:fs/promises";

export async function resolvePosition(
  filePath: string,
  line: number,
  name?: string
): Promise<{ line: number; character: number }> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");
  const zeroBasedLine = line - 1;

  if (zeroBasedLine < 0 || zeroBasedLine >= lines.length) {
    throw new Error(
      `Line ${line} is out of bounds. File has ${lines.length} lines (valid: 1–${lines.length}).`
    );
  }

  const lineText = lines[zeroBasedLine];
  let character: number;

  if (name) {
    const idx = lineText.indexOf(name);
    if (idx !== -1) {
      character = idx;
    } else {
      throw new Error(`Name "${name}" not found on line ${line}.`);
    }
  } else {
    const match = lineText.match(/\S/);
    character = match ? match.index! : 0;
  }

  return { line: zeroBasedLine, character: Math.min(character, lineText.length) };
}

export async function resolveRange(
  filePath: string,
  startLine: number,
  endLine?: number,
  name?: string
): Promise<{
  start: { line: number; character: number };
  end: { line: number; character: number };
}> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");
  const maxLine = lines.length;

  const zeroStartLine = startLine - 1;
  if (zeroStartLine < 0 || zeroStartLine >= maxLine) {
    throw new Error(
      `Line ${startLine} is out of bounds. File has ${maxLine} lines (valid: 1–${maxLine}).`
    );
  }

  const startLineText = lines[zeroStartLine];
  let startCharacter: number;

  if (name) {
    const idx = startLineText.indexOf(name);
    if (idx !== -1) {
      startCharacter = idx;
    } else {
      throw new Error(`Name "${name}" not found on line ${startLine}.`);
    }
  } else {
    const match = startLineText.match(/\S/);
    startCharacter = match ? match.index! : 0;
  }

  const zeroEndLine = endLine !== undefined ? endLine - 1 : zeroStartLine;
  const clampedEndLine = Math.max(0, Math.min(zeroEndLine, maxLine - 1));
  const endLineText = lines[clampedEndLine];

  return {
    start: { line: zeroStartLine, character: Math.min(startCharacter, startLineText.length) },
    end: { line: clampedEndLine, character: endLineText?.length ?? 0 },
  };
}
