import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getBrowserCommand(filePath: string): { command: string; args: string[] } {
  if (process.platform === "darwin") {
    return { command: "open", args: [filePath] };
  }

  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", filePath] };
  }

  return { command: "xdg-open", args: [filePath] };
}

export async function openFileInBrowser(
  filePath: string,
  runner: (command: string, args: string[]) => Promise<unknown> = (command, args) => execFileAsync(command, args)
): Promise<void> {
  const { command, args } = getBrowserCommand(filePath);
  await runner(command, args);
}
