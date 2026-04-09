import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCacheDir } from "../src/cache.js";

const touched: string[] = [];

afterEach(() => {
  delete process.env.WECHAT_MCP_CACHE_DIR;
  for (const p of touched.splice(0, touched.length)) {
    rmSync(p, { recursive: true, force: true });
  }
});

describe("ensureCacheDir", () => {
  it("prefers WECHAT_MCP_CACHE_DIR when available", () => {
    const custom = mkdtempSync(join(tmpdir(), "wechat-mcp-custom-"));
    touched.push(custom);
    process.env.WECHAT_MCP_CACHE_DIR = custom;

    const dir = ensureCacheDir();
    expect(dir).toBe(custom);
  });

  it("falls back to cwd .cache/wechat-mcp", () => {
    const cwd = mkdtempSync(join(tmpdir(), "wechat-mcp-cwd-"));
    touched.push(cwd);

    const dir = ensureCacheDir(cwd);
    expect(dir).toBe(join(cwd, ".cache", "wechat-mcp"));
  });
});
