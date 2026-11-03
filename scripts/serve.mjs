// Tiny static server for dist/ (service workers need http://localhost, not file://). Usage: npm run serve [port]
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const port = +(process.argv[2] || process.env.PORT || 8080);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
export const server = http.createServer(async (req, res) => {
  let p = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(dist)) { res.writeHead(403).end(); return; }
  try { if ((await stat(p)).isDirectory()) p = path.join(p, "index.html"); const body = await readFile(p);
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404, { "content-type": "text/plain" }).end("Not found"); }
});
server.listen(port, () => console.log(`Serving dist/ at http://localhost:${port}/`));
