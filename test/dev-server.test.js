// Testes de scripts/static-server.js (usado por `npm run dev`). Sobem o servidor numa porta livre
// e conferem o que o navegador precisa: index.html, src/main.js com tipo JavaScript (200), 404 e bloqueio de caminhos fora da pasta.
// Sem dependências: rodar com `npm test` (node --test, Node 18+).

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "../scripts/static-server.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Faz uma requisição crua (sem normalização de URL do fetch), para testar caminhos como /%2e%2e/.
function fetchRaw(port, path, method = "GET") {
  return new Promise((resolvePromise, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolvePromise({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("servidor de desenvolvimento estático", () => {
  let server;
  let port;

  before(async () => {
    server = createStaticServer(ROOT);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    port = server.address().port;
  });

  after(() => {
    server.close();
  });

  test("serve index.html na raiz", async () => {
    const res = await fetchRaw(port, "/");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/html/);
    assert.match(res.body, /<script src="src\/main\.js"><\/script>/);
    assert.doesNotMatch(res.body, /type="module"/);
  });

  test("serve src/main.js com status 200 e tipo JavaScript (caminho feliz do CALC-60)", async () => {
    const res = await fetchRaw(port, "/src/main.js");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/javascript/);
    assert.ok(res.body.length > 0);
  });

  test("serve CSS com tipo text/css", async () => {
    const res = await fetchRaw(port, "/css/tema.css");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/css/);
  });

  test("arquivo inexistente responde 404", async () => {
    const res = await fetchRaw(port, "/src/nao-existe.js");
    assert.equal(res.status, 404);
  });

  test("pasta sem index.html responde 404 em vez de quebrar", async () => {
    const res = await fetchRaw(port, "/src");
    assert.equal(res.status, 404);
  });

  test("caminho com .. codificado não sai da pasta do projeto", async () => {
    const res = await fetchRaw(port, "/%2e%2e/package.json");
    assert.equal(res.status, 403);
    assert.doesNotMatch(res.body, /"devDependencies"/);
  });

  test("percentual inválido responde 400", async () => {
    const res = await fetchRaw(port, "/%E0%A4%A");
    assert.equal(res.status, 400);
  });

  test("método diferente de GET/HEAD responde 405", async () => {
    const res = await fetchRaw(port, "/", "POST");
    assert.equal(res.status, 405);
    assert.equal(res.headers["allow"], "GET, HEAD");
  });
});
