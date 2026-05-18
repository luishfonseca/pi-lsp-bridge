import { resolve } from "node:path";
import { access } from "node:fs/promises";

export function normalizePath(input: string, cwd: string): string {
  let path = input.replace(/^@/, "");
  if (!path.startsWith("/")) {
    path = resolve(cwd, path);
  }
  return path;
}

export async function assertFileExists(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }
}
