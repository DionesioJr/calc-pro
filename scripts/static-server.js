// Servidor HTTP estático mínimo para desenvolvimento local, feito só com o módulo `http` do Node.
// Existe porque o navegador bloqueia módulos ES (`<script type="module">`) abertos por file://
// (CORS, origem "null"). Servindo por http://localhost, o src/main.js carrega normalmente.
// Sem dependências: usado por scripts/dev-server.js (`npm run dev`) e por test/dev-server.test.js.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Cria (sem iniciar) um servidor que serve os arquivos de `root`.
// Só aceita GET e HEAD, e nunca entrega um caminho fora de `root`.
export function createStaticServer(root) {
  const base = resolve(root);

  return createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }

    // Valida o caminho cru, sem passar por new URL(): o WHATWG URL já normaliza
    // "%2e%2e" para ".." e apagaria o segmento que precisa ser recusado.
    const rawPath = (req.url ?? "/").split("?")[0];

    let pathname;
    try {
      pathname = decodeURIComponent(rawPath);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    if (!pathname.startsWith("/") || pathname.includes("\0")) {
      res.writeHead(400);
      res.end();
      return;
    }

    if (pathname.split(/[\\/]/).includes("..")) {
      res.writeHead(403);
      res.end();
      return;
    }

    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }

    const filePath = resolve(base, "." + pathname);
    if (!filePath.startsWith(base + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }

    let body;
    try {
      body = await readFile(filePath);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Não encontrado");
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  });
}
