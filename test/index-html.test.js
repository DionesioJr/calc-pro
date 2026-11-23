// Testes de carregamento de index.html (CALC-58): a calculadora precisa funcionar aberta direto no navegador, por file://.
// Chrome e Edge bloqueiam <script type="module"> em file:// (origem nula, sem CORS), então a tela aparece mas o JavaScript
// não roda e nenhum clique ou tecla responde. Por isso os arquivos de src/ são scripts clássicos, carregados em ordem.
// Sem dependências: rodar com `npm test` (node --test, Node 18+).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "src");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

// Ordem de carregamento: cada arquivo só usa funções dos anteriores (ou de si mesmo) no momento em que é executado.
const SCRIPT_ORDER = [
  "src/calculator.js",
  "src/history.js",
  "src/keypad.js",
  "src/ui.js",
  "src/keyboard.js",
  "src/main.js",
];

describe("CALC-58: index.html carrega a calculadora sem servidor", () => {
  test('nenhum script é type="module" (módulos ES são bloqueados em file://)', () => {
    assert.doesNotMatch(HTML_SOURCE, /type="module"/);
  });

  test("cada arquivo de src/ é carregado por <script src> na ordem de dependência", () => {
    const loaded = [...HTML_SOURCE.matchAll(/<script src="(src\/[^"]+)"><\/script>/g)].map((match) => match[1]);
    assert.deepEqual(loaded, SCRIPT_ORDER);
  });

  test("nenhum arquivo de src/ usa import nem export (scripts clássicos não os aceitam)", () => {
    for (const name of fs.readdirSync(SRC_DIR)) {
      const code = fs.readFileSync(path.join(SRC_DIR, name), "utf8");
      assert.doesNotMatch(code, /^\s*(import|export)\b/m, `${name} ainda tem import/export`);
    }
  });

  test("os arquivos carregados existem em src/", () => {
    for (const script of SCRIPT_ORDER) {
      assert.ok(fs.existsSync(path.join(ROOT, script)), `${script} não existe`);
    }
  });
});

const CSS_SOURCE = ["tema.css", "display.css", "teclado.css", "historico.css"]
  .map((name) => fs.readFileSync(path.join(ROOT, "css", name), "utf8"))
  .join("\n");

describe("CALC-23: cartão com título Calculator visível e visor com expressão", () => {
  test('o título "Calculator" fica visível no topo do cartão, dentro de main.calculator, antes dos indicadores', () => {
    assert.match(
      HTML_SOURCE,
      /<main class="calculator" id="calculator">\s*<h1 class="calculator-title">Calculator<\/h1>/,
    );
    assert.ok(HTML_SOURCE.indexOf('class="calculator-title"') < HTML_SOURCE.indexOf('class="status"'));
  });

  test("o título não é mais escondido para leitor de tela: nenhuma regra de h1 usa clip ou sr-only, e .calculator-title é centralizado", () => {
    assert.doesNotMatch(CSS_SOURCE, /\.calculator h1\s*\{/);
    assert.match(CSS_SOURCE, /\.calculator-title\s*\{[^}]*text-align:\s*center;[^}]*\}/);
    assert.doesNotMatch(CSS_SOURCE, /\.calculator-title\s*\{[^}]*clip:/);
  });

  test("o visor agrupa a linha da expressão (sem aria-live, para não narrar cada tecla) e o resultado (com aria-live), nessa ordem", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="visor">\s*<div id="expression" class="expression"><\/div>\s*<output id="display" class="display" aria-live="polite">0<\/output>\s*<\/div>/,
    );
    assert.doesNotMatch(HTML_SOURCE, /id="expression"[^>]*aria-live/);
  });

  test("o visor fica depois da linha de status e antes do teclado", () => {
    assert.ok(HTML_SOURCE.indexOf('class="status"') < HTML_SOURCE.indexOf('class="visor"'));
    assert.ok(HTML_SOURCE.indexOf('class="visor"') < HTML_SOURCE.indexOf('class="panel"'));
  });
});
