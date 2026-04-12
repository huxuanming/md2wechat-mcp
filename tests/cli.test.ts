import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function runCli(args: string[]) {
  const root = resolve(import.meta.dirname, "..");
  return spawnSync(
    process.execPath,
    [resolve(root, "node_modules", "tsx", "dist", "cli.mjs"), resolve(root, "src", "cli.ts"), ...args],
    {
      encoding: "utf8",
      timeout: 5000
    }
  );
}

describe("cli", () => {
  it("shows usage with -h", () => {
    const proc = runCli(["-h"]);

    expect(proc.status).toBe(0);
    expect(proc.stdout.toLowerCase()).toContain("usage");
    expect(proc.stdout).toContain("md2wechat");
    expect(proc.stdout).not.toContain("--copy");
  });

  it("fails for invalid theme", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wechat-md-cli-"));
    const input = join(tempDir, "input.md");
    writeFileSync(input, "# Title\n", "utf8");

    try {
      const proc = runCli([input, "--theme", "bad-theme"]);
      expect(proc.status).toBe(1);
      expect(proc.stderr).toContain("Invalid theme: bad-theme");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when input file does not exist", () => {
    const proc = runCli([join(tmpdir(), "wechat-md-missing-file.md")]);
    expect(proc.status).toBe(1);
    expect(proc.stderr).toContain("ENOENT");
  });

  it("fails for invalid font size preset", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wechat-md-cli-"));
    const input = join(tempDir, "input.md");
    writeFileSync(input, "# Title\n", "utf8");

    try {
      const proc = runCli([input, "--font-size-preset", "huge"]);
      expect(proc.status).toBe(1);
      expect(proc.stderr).toContain("Invalid font size preset: huge");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
