import { describe, expect, it, vi } from "vitest";
import { openFileInBrowser } from "../src/browser.js";

describe("openFileInBrowser", () => {
  it("opens a local html file", async () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    await expect(openFileInBrowser("/tmp/wechat-open.html", runner)).resolves.toBeUndefined();
    expect(runner).toHaveBeenCalledTimes(1);
  });
});
