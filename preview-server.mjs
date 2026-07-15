import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".sql": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const filePath = normalize(join(root, requested));
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (filePath !== root && !filePath.startsWith(rootWithSep)) {
    return null;
  }
  return filePath;
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    const filePath = safePath(url.pathname);
    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    // Ensure file exists (and is a file)
    const info = await stat(filePath);
    if (!info.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const body = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const headers = {
      "content-type": types[ext] || "application/octet-stream",
      "cache-control": ext === ".html" || ext === ".js" || ext === ".json"
        ? "no-cache"
        : "public, max-age=86400",
    };

    // Service Worker must be served with correct scope-friendly headers
    if (filePath.endsWith(`${sep}sw.js`) || filePath.endsWith("/sw.js")) {
      headers["service-worker-allowed"] = "/";
      headers["cache-control"] = "no-cache";
    }

    response.writeHead(200, headers);
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`Aether Tasks (PWA) em http://localhost:${port}`);
  console.log(`Abra no Chrome/Edge para instalar o app (ícone na barra de endereço).`);
});
