import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const dist = join(root, "dist");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const zipName = `joblens-v${version}-cws.zip`;
const zipPath = join(root, zipName);

if (!existsSync(dist)) {
  console.error("dist/ not found. Run npm run build first.");
  process.exit(1);
}

if (existsSync(zipPath)) {
  rmSync(zipPath);
}

if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path (Join-Path '${dist.replace(/'/g, "''")}' '*') -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" }
  );
} else {
  execFileSync("zip", ["-r", zipPath, "."], { cwd: dist, stdio: "inherit" });
}

console.log(`Packaged: ${zipName}`);
