import { describe, expect, it, vi } from "vitest";
import { openFileInBrowser } from "../src/browser.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";

describe("openFileInBrowser", () => {
  it("opens a local html file", async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    const dir = mkdtempSync(join(tmpdir(), "wechat-open-"));
    const filePath = join(dir, "wechat-open.html");
    writeFileSync(filePath, "<html></html>", "utf8");
    await expect(openFileInBrowser(filePath, runner)).resolves.toBeUndefined();
    expect(runner).toHaveBeenCalledTimes(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when file does not exist", async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    await expect(openFileInBrowser(join(tmpdir(), "wechat-not-exists-12345.html"), runner)).rejects.toBeTruthy();
    expect(runner).not.toHaveBeenCalled();
  });
});
