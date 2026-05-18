import { readFile, access } from "node:fs/promises";

export interface FuzzyMatchInfo {
  requestedLine: number;
  requestedName: string;
  matchedLine: number;
  matchedName: string;
  distance: number;
}

function findFuzzyNameMatch(
  lines: string[],
  zeroBasedLine: number,
  name: string,
  window: number
): { line: number; character: number; matchedName: string } | null {
  let bestScore: number | null = null;
  let bestLine = -1;
  let bestChar = -1;
  let bestMatchedName = "";

  for (let offset = 1; offset <= window; offset++) {
    for (const dir of [-1, 1] as const) {
      const candidateLine = zeroBasedLine + offset * dir;
      if (candidateLine < 0 || candidateLine >= lines.length) continue;

      const text = lines[candidateLine];
      let idx = text.indexOf(name);
      let matchedName = name;
      let isCaseInsensitive = false;

      if (idx === -1) {
        const lowerText = text.toLowerCase();
        const lowerName = name.toLowerCase();
        idx = lowerText.indexOf(lowerName);
        if (idx !== -1) {
          matchedName = text.slice(idx, idx + name.length);
          isCaseInsensitive = true;
        }
      }

      if (idx !== -1) {
        const score = offset + (isCaseInsensitive ? 100 : 0);
        if (
          bestScore === null ||
          score < bestScore ||
          (score === bestScore && idx < bestChar)
        ) {
          bestScore = score;
          bestLine = candidateLine;
          bestChar = idx;
          bestMatchedName = matchedName;
        }
      }
    }
  }

  if (bestLine === -1) return null;

  return {
    line: bestLine,
    character: Math.min(bestChar, lines[bestLine].length),
    matchedName: bestMatchedName,
  };
}

export function formatFuzzyWarning(fuzzy: FuzzyMatchInfo): string {
  const plural = fuzzy.distance === 1 ? "" : "s";
  return `> **Fuzzy match**: Name "${fuzzy.requestedName}" not found on line ${fuzzy.requestedLine}. Using "${fuzzy.matchedName}" on line ${fuzzy.matchedLine} (${fuzzy.distance} line${plural} away).\n\n---\n\n`;
}

export async function resolvePosition(
  filePath: string,
  line: number,
  name?: string
): Promise<{ line: number; character: number; fuzzy?: FuzzyMatchInfo }> {
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

  if (!name) {
    const match = lineText.match(/\S/);
    const character = match ? match.index! : 0;
    return { line: zeroBasedLine, character };
  }

  const exactIdx = lineText.indexOf(name);
  if (exactIdx !== -1) {
    return {
      line: zeroBasedLine,
      character: Math.min(exactIdx, lineText.length),
    };
  }

  const fuzzyMatch = findFuzzyNameMatch(lines, zeroBasedLine, name, 10);
  if (fuzzyMatch) {
    return {
      line: fuzzyMatch.line,
      character: fuzzyMatch.character,
      fuzzy: {
        requestedLine: line,
        requestedName: name,
        matchedLine: fuzzyMatch.line + 1,
        matchedName: fuzzyMatch.matchedName,
        distance: Math.abs(fuzzyMatch.line - zeroBasedLine),
      },
    };
  }

  throw new Error(`Name "${name}" not found on line ${line} or within ±10 lines.`);
}

export async function resolveRange(
  filePath: string,
  startLine: number,
  endLine?: number,
  name?: string
): Promise<{
  start: { line: number; character: number };
  end: { line: number; character: number };
  fuzzy?: FuzzyMatchInfo;
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
  let fuzzy: FuzzyMatchInfo | undefined;

  if (name) {
    const idx = startLineText.indexOf(name);
    if (idx !== -1) {
      startCharacter = idx;
    } else {
      const fuzzyMatch = findFuzzyNameMatch(lines, zeroStartLine, name, 10);
      if (fuzzyMatch) {
        startCharacter = fuzzyMatch.character;
        fuzzy = {
          requestedLine: startLine,
          requestedName: name,
          matchedLine: fuzzyMatch.line + 1,
          matchedName: fuzzyMatch.matchedName,
          distance: Math.abs(fuzzyMatch.line - zeroStartLine),
        };
      } else {
        throw new Error(`Name "${name}" not found on line ${startLine} or within ±10 lines.`);
      }
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
    fuzzy,
  };
}
