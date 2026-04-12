import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessToken } from "../src/wechat-api.js";

describe("wechat-api timeout", () => {
  beforeEach(() => {
    delete process.env.WECHAT_API_TIMEOUT_MS;
  });

  it("throws timeout error on AbortError", async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAccessToken("appid", "secret")).rejects.toThrow(/timeout/i);

    vi.unstubAllGlobals();
  });

  it("uses WECHAT_API_TIMEOUT_MS when provided", async () => {
    process.env.WECHAT_API_TIMEOUT_MS = "1234";
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAccessToken("appid", "secret")).rejects.toThrow("1234ms");

    vi.unstubAllGlobals();
  });
});

