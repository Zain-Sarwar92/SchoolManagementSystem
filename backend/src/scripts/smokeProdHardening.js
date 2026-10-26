/**
 * Offline smoke checks for production-hardening wiring (no Mongo required).
 * Usage: node src/scripts/smokeProdHardening.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");
const failures = [];

function ok(label) {
  console.log(`  PASS  ${label}`);
}
function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
  console.log(`  FAIL  ${label} — ${detail}`);
}

function assertFileContains(rel, needle, label) {
  const full = path.join(backendRoot, rel);
  if (!fs.existsSync(full)) {
    fail(label, `missing file ${rel}`);
    return;
  }
  const text = fs.readFileSync(full, "utf8");
  if (!text.includes(needle)) {
    fail(label, `expected to contain ${JSON.stringify(needle)}`);
    return;
  }
  ok(label);
}

console.log("Production hardening smoke (offline)\n");

assertFileContains(
  "src/server.js",
  "PTS_MEDIA_ROOT",
  "PTS_MEDIA_ROOT is configurable"
);
assertFileContains(
  "src/server.js",
  "/uploads/academy-logos",
  "Only academy logos are public static"
);
assertFileContains(
  "src/server.js",
  "SIGTERM",
  "Graceful shutdown handlers registered"
);
assertFileContains(
  "src/routes/index.js",
  'mongoOk ? "connected"',
  "Health check reports Mongo status"
);
assertFileContains(
  "src/routes/uploadRoutes.js",
  "/student-files/:filename",
  "Authenticated student-file download route exists"
);
assertFileContains(
  "src/scripts/seedSuperAdmin.js",
  "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD",
  "Super Admin seed requires env credentials"
);
assertFileContains(
  "src/routes/classRoutes.js",
  'requireAcademyModule("ACADEMY_MANAGEMENT")',
  "Classes gated by Academy Management module"
);
assertFileContains(
  "src/routes/sectionRoutes.js",
  'requireAcademyModule("ACADEMY_MANAGEMENT")',
  "Sections gated by Academy Management module"
);
assertFileContains(
  "src/routes/teacherRoutes.js",
  'requireAcademyModule("ACADEMY_MANAGEMENT")',
  "Teachers gated by Academy Management module"
);

const envExample = path.join(backendRoot, "env.example");
if (fs.existsSync(envExample)) {
  ok("Committed env.example present");
} else {
  fail("Committed env.example present", "backend/env.example missing");
}

console.log("");
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("All hardening smoke checks passed");
