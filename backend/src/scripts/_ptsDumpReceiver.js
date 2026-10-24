/** Tiny server: GET /dump.js  POST /dump → write live hierarchy JSON */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8790;
const DRIVER = fs.readFileSync(
  path.join(__dirname, "_dumpPtsLiveHierarchy.browser.js"),
  "utf8"
);
const OUT = path.resolve(
  __dirname,
  "../../data/lahore-board/_live-hierarchy-9-12.json"
);

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/dump.js") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(DRIVER);
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "POST" && req.url === "/dump") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString("utf8");
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, body);
    console.log("Wrote", OUT, "bytes", body.length);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: OUT }));
    return;
  }
  res.writeHead(404);
  res.end("no");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("dump receiver http://127.0.0.1:" + PORT);
});
