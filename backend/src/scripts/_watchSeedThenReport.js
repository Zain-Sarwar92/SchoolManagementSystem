/**
 * Wait until seedPtsLiveBank is not running, then build matrix + live verify.
 */
import { spawn } from "child_process";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const logPath = path.join(root, "data/pts-live/_watch-status.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(logPath, line + "\n");
  } catch {
    /* ignore lock / redirect conflicts */
  }
}

function seedRunning() {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -like '*seedPtsLiveBank*' } | Select-Object -ExpandProperty ProcessId"`,
      { encoding: "utf8" }
    );
    return Boolean(out.trim());
  } catch {
    return false;
  }
}

fs.mkdirSync(path.dirname(logPath), { recursive: true });
log("Watching for seedPtsLiveBank to finish…");

while (seedRunning()) {
  await new Promise((r) => setTimeout(r, 60000));
  try {
    const p = JSON.parse(
      fs.readFileSync(path.join(root, "data/pts-live/_progress.json"), "utf8")
    );
    const n = Object.keys(p.done || {}).length;
    log(`still running… subjects done=${n}`);
  } catch {
    log("still running…");
  }
}

log("Seed finished. Building matrix + live verify…");

const env = {
  ...process.env,
  PTS_USER: process.env.PTS_USER || "03334404102",
  PTS_PASS: process.env.PTS_PASS || "AlhadiSchlAc7860",
};

await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    ["src/scripts/reportPtsBankMatrix.js", "--verify"],
    { cwd: root, env, stdio: "inherit" }
  );
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`report exited ${code}`));
  });
});

log("Report ready: data/pts-live/_bank-matrix.md + _bank-matrix.json");
