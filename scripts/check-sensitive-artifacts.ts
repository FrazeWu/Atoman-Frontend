import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Browser authentication state must never be tracked, even through git add -f.
export function sensitiveAuthArtifacts(paths: readonly string[]): string[] {
  return paths.filter((path) => /(^|\/)\.auth\//.test(path.replaceAll("\\", "/")));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
    const blocked = sensitiveAuthArtifacts(tracked.split("\0").filter(Boolean));
    if (blocked.length) {
      console.error("Refusing tracked browser authentication state:\n" + blocked.join("\n"));
      process.exitCode = 1;
    } else {
      console.log("No browser authentication state is tracked.");
    }
  } catch (error) {
    console.error("Unable to verify tracked authentication artifacts:", error instanceof Error ? error.message : "git failed");
    process.exitCode = 1;
  }
}
