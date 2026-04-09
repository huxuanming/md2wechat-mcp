import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { resolve, join } from "node:path";

function ensureWritableDirectory(path: string): string | null {
  try {
    mkdirSync(path, { recursive: true });
    return path;
  } catch {
    return null;
  }
}

export function ensureCacheDir(cwd?: string): string {
  const baseDir = cwd ?? process.cwd();
  const xdgCache = process.env.XDG_CACHE_HOME;
  const candidates = [
    process.env.WECHAT_MCP_CACHE_DIR,
    join(baseDir, ".cache", "wechat-mcp"),
    join(process.cwd(), ".cache", "wechat-mcp"),
    xdgCache ? join(resolve(xdgCache), "wechat-mcp") : undefined,
    process.platform === "darwin" ? join(homedir(), "Library", "Caches", "wechat-mcp") : join(homedir(), ".cache", "wechat-mcp"),
    join(tmpdir(), "wechat-mcp")
  ];

  for (const raw of candidates) {
    if (!raw) {
      continue;
    }
    const candidate = resolve(raw);
    const writable = ensureWritableDirectory(candidate);
    if (writable) {
      return writable;
    }
  }

  throw new Error("Failed to create cache directory.");
}

export function saveHtmlCache(html: string, cwd?: string, cacheDir?: string): string {
  const finalDir = cacheDir ? resolve(cacheDir) : ensureCacheDir(cwd);
  mkdirSync(finalDir, { recursive: true });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const filePath = join(finalDir, `wechat-${stamp}.html`);
  writeFileSync(filePath, html, "utf8");
  return filePath;
}
