"use strict";

// Testes da entrada de dígitos e ponto decimal (CALC-4) e da lógica de operações (CALC-5).
// Executa script.js real num contexto isolado, com um DOM mínimo, e aperta
// os botões pelo mesmo caminho de clique que o navegador usa.
// Sem dependências: rodar com `npm test` (node --test, Node 18+).

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const SCRIPT_SOURCE = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

// Teclas usadas nos testes, com os mesmos data-* que index.html define para cada botão.
const KEY_DATASET = {
  0: { value: "0" },
  1: { value: "1" },
  2: { value: "2" },
  3: { value: "3" },
  4: { value: "4" },
  5: { value: "5" },
  6: { value: "6" },
  7: { value: "7" },
  8: { value: "8" },
  9: { value: "9" },
  ".": { value: "." },
  "+": { action: "add" },
  "−": { action: "subtract" },
  "×": { action: "multiply" },
  "÷": { action: "divide" },
  "=": { action: "equals" },
};

function createCalculator() {
  const display = { textContent: "" };
  let onKeypadClick = null;

  const keypad = {
    addEventListener(type, listener) {
      if (type === "click") {
        onKeypadClick = listener;
      }
    },
    contains: () => true,
  };

  const document = {
    getElementById: (id) => (id === "display" ? display : null),
    querySelector: (selector) => (selector === ".keypad" ? keypad : null),
  };

  vm.runInNewContext(SCRIPT_SOURCE, { document }, { filename: "script.js" });

  // Aperta as teclas em sequência e devolve o texto final do display.
  function press(...keys) {
    for (const key of keys) {
      const button = { dataset: KEY_DATASET[key] };
      onKeypadClick({ target: { closest: () => button } });
    }
    return display.textContent;
  }

  return { press };
}

describe("index.html expõe os botões usados pelos testes", () => {
  test("há display, teclado, botão de ponto, de igual e de operadores", () => {
    assert.match(HTML_SOURCE, /id="display"/);
    assert.match(HTML_SOURCE, /class="keypad"/);
    assert.match(HTML_SOURCE, /data-value="\."/);
    assert.match(HTML_SOURCE, /data-action="equals"/);
    assert.match(HTML_SOURCE, /data-action="divide"/);
  });
});

describe("CALC-4: critérios de aceite da entrada de dígitos e ponto decimal", () => {
  test("7, 8, ponto, 5 resulta em 78.5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("7", "8", ".", "5"), "78.5");
  });

  test("o segundo ponto é ignorado: 7, 8, ponto, 5, ponto, 2 resulta em 78.52", () => {
    const calc = createCalculator();
    assert.equal(calc.press("7", "8", ".", "5", ".", "2"), "78.52");
  });

  test("0 duas vezes resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", "0"), "0");
  });
});

describe("CALC-4: casos de borda da entrada de dígitos e ponto decimal", () => {
  test("ponto sozinho mostra 0.", () => {
    const calc = createCalculator();
    assert.equal(calc.press("."), "0.");
  });

  test("pontos repetidos seguidos não alteram o número", () => {
    const calc = createCalculator();
    assert.equal(calc.press(".", ".", "."), "0.");
  });

  test("zero seguido de ponto e dígito mantém o zero inicial: 0, ponto, 5 resulta em 0.5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", ".", "5"), "0.5");
  });

  test("zero à esquerda é substituído pelo primeiro dígito: 0, 0, 7 resulta em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", "0", "7"), "7");
  });

  test("ponto logo após operador começa o segundo número com 0.: 2, +, ponto, 5, igual resulta em 2.5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", ".", "5", "="), "2.5");
  });

  test("segundo ponto é ignorado no segundo operando: 2, +, 1, ponto, 5, ponto, 5, igual resulta em 3.55", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "1", ".", "5", ".", "5", "="), "3.55");
  });

  test("ponto após igual começa um novo número: 2, +, 3, igual, ponto resulta em 0.", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "=", "."), "0.");
  });

  test("ponto após erro começa um novo número: 5, ÷, 0, igual, ponto resulta em 0.", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "=", "."), "0.");
  });

  test("dígito após igual começa um novo número: 2, +, 3, igual, 7 resulta em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "=", "7"), "7");
  });
});

describe("CALC-5: critérios mínimos da lógica de operações", () => {
  test("2 + 3 = resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "="), "5");
  });

  test("9 ÷ 3 = resulta em 3", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "÷", "3", "="), "3");
  });

  test("2 + 3 × 4 = resulta em 20 (avaliação da esquerda para a direita)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "×", "4", "="), "20");
  });

  test("trocar + por − antes do segundo número aplica a subtração: 7, +, −, 2, igual resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("7", "+", "−", "2", "="), "5");
  });

  test("divisão por zero mostra Erro: 5, ÷, 0, igual resulta em Erro", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "="), "Erro");
  });

  test("2 + = mostra 4 (igual sem segundo número usa o primeiro)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "="), "4");
  });
});

describe("CALC-5: formatação com 12 algarismos significativos", () => {
  test("1 ÷ 3 = resulta em 0.333333333333 (12 algarismos)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "÷", "3", "="), "0.333333333333");
  });

  test("2 ÷ 3 = arredonda o 12º algarismo: resulta em 0.666666666667", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "÷", "3", "="), "0.666666666667");
  });

  test("0.1 + 0.2 = resulta em 0.3, sem ruído de ponto flutuante", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", ".", "1", "+", "0", ".", "2", "="), "0.3");
  });
});
