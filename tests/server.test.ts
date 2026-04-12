import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

function runServer(args: string[]) {
  const root = resolve(import.meta.dirname, "..");
  return spawnSync(
    process.execPath,
    [resolve(root, "node_modules", "tsx", "dist", "cli.mjs"), resolve(root, "src", "server.ts"), ...args],
    {
      encoding: "utf8",
      timeout: 5000
    }
  );
}

describe("server", () => {
  it("shows all major tools in help output", () => {
    const proc = runServer(["-h"]);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("wechat_markdown_to_draft");
    expect(proc.stdout).toContain("wechat_get_access_token");
    expect(proc.stdout).toContain("wechat_add_material");
    expect(proc.stdout).toContain("wechat_draft_add");
    expect(proc.stdout).toContain("meta.cacheHtmlPath");
  });

  it("includes fallback instruction for clients without meta visibility", () => {
    const root = resolve(import.meta.dirname, "..");
    const source = readFileSync(resolve(root, "src", "server.ts"), "utf8");

    expect(source).toContain("content[1].text");
    expect(source).toContain("cacheHtmlPath=");
    expect(source).toContain("不得用“最近文件”或路径猜测替代");
  });
});
