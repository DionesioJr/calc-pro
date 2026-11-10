// Testes do motor de cálculo (src/calculator.js) avaliado direto no Node, sem DOM: as ações recebem e devolvem o estado.
// Os testes de ponta a ponta com o DOM mínimo ficam em calculadora.test.js.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const CALCULATOR_SOURCE = fs.readFileSync(path.join(SRC_DIR, "calculator.js"), "utf8");

// src/ são scripts clássicos (o navegador os carrega sem import/export): aqui os arquivos entram no mesmo escopo, na ordem de index.html.
function carregarScripts(arquivos, nomes) {
  const codigo = arquivos.map((arquivo) => fs.readFileSync(path.join(SRC_DIR, arquivo), "utf8")).join("\n;\n");
  return new Function(`${codigo}\nreturn { ${nomes.join(", ")} };`)();
}
const { ACTIONS, deleteDigit, handleButton, initialState, showResult, fillKeypadMarkup } = carregarScripts(
  ["calculator.js", "keypad.js"],
  ["ACTIONS", "deleteDigit", "handleButton", "initialState", "showResult", "fillKeypadMarkup"],
);
// HTML final: index.html com os botões gerados a partir do registro (CALC-59).
const INDEX_HTML = fillKeypadMarkup(fs.readFileSync(path.join(SRC_DIR, "..", "index.html"), "utf8"));

// Aplica uma sequência de botões (data-value ou data-action) e junta as linhas do histórico que as ações geraram.
function run(state, datasets) {
  let current = state;
  const history = [];
  for (const dataset of datasets) {
    const result = handleButton(current, dataset);
    current = result.state;
    history.push(...result.history);
  }
  return { state: current, history };
}

describe("CALC-52: o motor não depende do DOM nem do armazenamento", () => {
  test("calculator.js não referencia document, window nem localStorage", () => {
    assert.doesNotMatch(CALCULATOR_SOURCE, /\b(document|window|localStorage)\b/);
  });
});

describe("CALC-52: o motor recebe e devolve estado", () => {
  test("handleButton não altera o estado recebido", () => {
    const before = initialState();
    const snapshot = JSON.stringify(before);
    handleButton(before, { value: "2" });
    handleButton(before, { action: "add" });
    assert.equal(JSON.stringify(before), snapshot);
  });

  test("2 + 3 = devolve o visor 5 e a linha do histórico", () => {
    const result = run(initialState(), [{ value: "2" }, { action: "add" }, { value: "3" }, { action: "equals" }]);
    assert.equal(result.state.current, "5");
    assert.deepEqual(result.history, ["2 + 3 = 5"]);
  });

  test("ação desconhecida devolve o mesmo estado e nenhuma linha do histórico", () => {
    const result = handleButton(initialState(), { action: "nao-existe" });
    assert.deepEqual(result.state, initialState());
    assert.deepEqual(result.history, []);
  });

  test("divisão por zero mostra Erro e não gera linha do histórico: 5, ÷, 0, = resulta em Erro", () => {
    const result = run(initialState(), [{ value: "5" }, { action: "divide" }, { value: "0" }, { action: "equals" }]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("um dígito digitado não gera linha do histórico", () => {
    const result = run(initialState(), [{ value: "7" }]);
    assert.equal(result.state.current, "7");
    assert.deepEqual(result.history, []);
  });

  test("resultado do histórico usado como operando: 4, depois + 1 = resulta em 5", () => {
    const state = showResult(initialState(), "4");
    const result = run(state, [{ action: "add" }, { value: "1" }, { action: "equals" }]);
    assert.equal(result.state.current, "5");
  });

  test("deleteDigit devolve um estado novo e apaga o último dígito do estado recebido", () => {
    const before = { ...initialState(), current: "12" };
    const after = deleteDigit(before);
    assert.equal(after.current, "1");
    assert.equal(before.current, "12");
  });

  test("M+ grava o visor na memória do estado devolvido: 5, M+ resulta em memória 5", () => {
    const result = run(initialState(), [{ value: "5" }, { action: "memory-add" }]);
    assert.equal(result.state.memory, 5);
  });
});

describe("CALC-57: o % em soma e subtração usa o operando anterior como base", () => {
  test("100 − 10% = devolve o visor 90 e a linha do histórico 100 − 10 = 90 (não 100 − 0.1)", () => {
    const result = run(initialState(), [
      { value: "1" },
      { value: "0" },
      { value: "0" },
      { action: "subtract" },
      { value: "1" },
      { value: "0" },
      { action: "percent" },
      { action: "equals" },
    ]);
    assert.equal(result.state.current, "90");
    assert.deepEqual(result.history, ["100 − 10 = 90"]);
  });

  test("10% sozinho continua 0.1 e não grava histórico: 1, 0, % resulta em 0.1", () => {
    const result = run(initialState(), [{ value: "1" }, { value: "0" }, { action: "percent" }]);
    assert.equal(result.state.current, "0.1");
    assert.deepEqual(result.history, []);
  });
});

describe("CALC-69: a tecla 2nd alterna a função secundária do botão", () => {
  test("2nd liga e desliga: o estado começa sem 2nd, 2nd liga, 2nd de novo desliga", () => {
    assert.equal(initialState().secondary, false);
    const on = run(initialState(), [{ action: "secondary" }]);
    assert.equal(on.state.secondary, true);
    const off = run(initialState(), [{ action: "secondary" }, { action: "secondary" }]);
    assert.equal(off.state.secondary, false);
  });

  test("2nd não mexe no visor, na memória nem no histórico: 16, 2nd resulta em 16 sem linha", () => {
    const result = run(showResult(initialState(), "16"), [{ action: "secondary" }]);
    assert.equal(result.state.current, "16");
    assert.equal(result.state.memory, 0);
    assert.deepEqual(result.history, []);
  });

  test("2nd + x² roda a função secundária, √x: 16, 2nd, x² resulta em 4 e a linha do histórico √16 = 4", () => {
    const result = run(showResult(initialState(), "16"), [{ action: "secondary" }, { action: "square" }]);
    assert.equal(result.state.current, "4");
    assert.deepEqual(result.history, ["√16 = 4"]);
  });

  test("x² sem a 2nd continua elevando ao quadrado: 3, x² resulta em 9", () => {
    const result = run(showResult(initialState(), "3"), [{ action: "square" }]);
    assert.equal(result.state.current, "9");
    assert.deepEqual(result.history, ["3² = 9"]);
  });

  test("a 2nd é consumida pela função: 2nd, 16, x² (√x) e depois x² de novo eleva 4 ao quadrado", () => {
    const result = run(showResult(initialState(), "16"), [
      { action: "secondary" },
      { action: "square" },
      { action: "square" },
    ]);
    assert.equal(result.state.current, "16");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["√16 = 4", "4² = 16"]);
  });

  test("a 2nd continua ativa através de dígitos: 2nd, 2, 5, x² resulta em √25 = 5", () => {
    const result = run(initialState(), [
      { action: "secondary" },
      { value: "2" },
      { value: "5" },
      { action: "square" },
    ]);
    assert.equal(result.state.current, "5");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["√25 = 5"]);
  });

  test("a 2nd não é consumida por operador: 2nd, 2, +, 9, x² roda √x sobre o 9 (√9 = 3)", () => {
    const result = run(initialState(), [
      { action: "secondary" },
      { value: "2" },
      { action: "add" },
      { value: "9" },
      { action: "square" },
    ]);
    assert.equal(result.state.current, "3");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["√9 = 3"]);
  });

  test("função sem secundária usa a primária e ainda consome a 2nd: 4, 2nd, 1/x resulta em 0.25", () => {
    const result = run(showResult(initialState(), "4"), [{ action: "secondary" }, { action: "inverse" }]);
    assert.equal(result.state.current, "0.25");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["1/4 = 0.25"]);
  });

  test("secundária com erro mostra Erro e não grava histórico: -4, 2nd, x² resulta em Erro", () => {
    const result = run(showResult(initialState(), "-4"), [{ action: "secondary" }, { action: "square" }]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("AC não desliga a 2nd: 2nd, AC, 16, x² ainda roda √x", () => {
    const result = run(initialState(), [
      { action: "secondary" },
      { action: "all-clear" },
      { value: "1" },
      { value: "6" },
      { action: "square" },
    ]);
    assert.equal(result.state.current, "4");
    assert.deepEqual(result.history, ["√16 = 4"]);
  });

  test("o botão 2nd está no registro com buttonId secondary-toggle, e a tecla x² tem a secundária √x", () => {
    const secondaryAction = ACTIONS.find((action) => action.id === "secondary");
    assert.equal(secondaryAction.buttonId, "secondary-toggle");
    assert.match(INDEX_HTML, /<button[^>]*id="secondary-toggle"[^>]*data-action="secondary"/);
    const square = ACTIONS.find((action) => action.id === "square");
    assert.equal(square.secondary.label, "√x");
  });
});

describe("CALC-69: log, ln, sen, cos e tan têm função secundária na 2nd", () => {
  test("cada função científica do registro tem a secundária certa: log → 10ˣ, ln → eˣ, sen → asen, cos → acos, tan → atan", () => {
    const expected = { log: "10ˣ", ln: "eˣ", sine: "asen", cos: "acos", tan: "atan" };
    for (const [id, label] of Object.entries(expected)) {
      const action = ACTIONS.find((item) => item.id === id);
      assert.equal(action.secondary.label, label, id);
      assert.ok(action.secondary.ariaLabel.length > 0, `${id} sem aria-label`);
    }
  });

  test("log sem a 2nd continua calculando log10: 100, log resulta em 2", () => {
    const result = run(showResult(initialState(), "100"), [{ action: "log" }]);
    assert.equal(result.state.current, "2");
    assert.deepEqual(result.history, ["log(100) = 2"]);
  });

  test("2nd + log roda 10ˣ: 2, 2nd, log resulta em 100 e a linha 10^2 = 100", () => {
    const result = run(showResult(initialState(), "2"), [{ action: "secondary" }, { action: "log" }]);
    assert.equal(result.state.current, "100");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["10^2 = 100"]);
  });

  test("10ˣ de negativo usa parênteses na linha: -2, 2nd, log resulta em 0.01 e a linha 10^(-2) = 0.01", () => {
    const result = run(showResult(initialState(), "-2"), [{ action: "secondary" }, { action: "log" }]);
    assert.equal(result.state.current, "0.01");
    assert.deepEqual(result.history, ["10^(-2) = 0.01"]);
  });

  test("10ˣ que passa de 2^53 mostra Erro e não grava histórico: 400, 2nd, log resulta em Erro", () => {
    const result = run(showResult(initialState(), "400"), [{ action: "secondary" }, { action: "log" }]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("2nd + ln roda eˣ: 1, 2nd, ln resulta em 2.71828183 e a linha e^1 = 2.71828183", () => {
    const result = run(showResult(initialState(), "1"), [{ action: "secondary" }, { action: "ln" }]);
    assert.equal(result.state.current, "2.71828183");
    assert.deepEqual(result.history, ["e^1 = 2.71828183"]);
  });

  test("eˣ de 1000 passa de 2^53 e mostra Erro: 1000, 2nd, ln resulta em Erro", () => {
    const result = run(showResult(initialState(), "1000"), [{ action: "secondary" }, { action: "ln" }]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("ln sem a 2nd continua calculando logaritmo natural: 1, ln resulta em 0", () => {
    const result = run(showResult(initialState(), "1"), [{ action: "ln" }]);
    assert.equal(result.state.current, "0");
    assert.deepEqual(result.history, ["ln(1) = 0"]);
  });

  test("2nd + sen roda asen em graus: 1, 2nd, sen resulta em 90 e a linha asen(1) = 90", () => {
    const result = run(showResult(initialState(), "1"), [{ action: "secondary" }, { action: "sine" }]);
    assert.equal(result.state.current, "90");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["asen(1) = 90"]);
  });

  test("asen em radianos devolve radianos: DEG→RAD, 1, 2nd, sen resulta em 1.57079633", () => {
    const result = run(showResult(initialState(), "1"), [
      { action: "angle-unit" },
      { action: "secondary" },
      { action: "sine" },
    ]);
    assert.equal(result.state.current, "1.57079633");
    assert.deepEqual(result.history, ["asen(1) = 1.57079633"]);
  });

  test("asen fora de −1 a 1 mostra Erro e não grava histórico: 2, 2nd, sen resulta em Erro", () => {
    const result = run(showResult(initialState(), "2"), [{ action: "secondary" }, { action: "sine" }]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("sen sem a 2nd continua calculando o seno em graus: 30, sen resulta em 0.5", () => {
    const result = run(showResult(initialState(), "30"), [{ action: "sine" }]);
    assert.equal(result.state.current, "0.5");
    assert.deepEqual(result.history, ["sen(30) = 0.5"]);
  });

  test("2nd + cos roda acos em graus: 0, 2nd, cos resulta em 90 e a linha acos(0) = 90", () => {
    const result = run(showResult(initialState(), "0"), [{ action: "secondary" }, { action: "cos" }]);
    assert.equal(result.state.current, "90");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["acos(0) = 90"]);
  });

  test("acos fora de −1 a 1 mostra Erro: 1,5, 2nd, cos resulta em Erro", () => {
    const result = run(showResult(initialState(), "1.5"), [{ action: "secondary" }, { action: "cos" }]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("2nd + tan roda atan em graus: 1, 2nd, tan resulta em 45 e a linha atan(1) = 45", () => {
    const result = run(showResult(initialState(), "1"), [{ action: "secondary" }, { action: "tan" }]);
    assert.equal(result.state.current, "45");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["atan(1) = 45"]);
  });

  test("atan aceita qualquer número, inclusive negativo: -1, 2nd, tan resulta em -45", () => {
    const result = run(showResult(initialState(), "-1"), [{ action: "secondary" }, { action: "tan" }]);
    assert.equal(result.state.current, "-45");
    assert.deepEqual(result.history, ["atan(-1) = -45"]);
  });

  test("a 2nd é consumida por log: 2, 2nd, log, log resulta em 2 (10ˣ e depois log de 100)", () => {
    const result = run(showResult(initialState(), "2"), [
      { action: "secondary" },
      { action: "log" },
      { action: "log" },
    ]);
    assert.equal(result.state.current, "2");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["10^2 = 100", "log(100) = 2"]);
  });
});

describe("CALC-70: sen⁻¹, cos⁻¹ e tan⁻¹ (asen, acos, atan) respeitam DEG/RAD e o domínio", () => {
  test("critério: sen⁻¹(0,5) = 30 em DEG: 0.5, 2nd, sen resulta em 30 e a linha asen(0.5) = 30", () => {
    const result = run(showResult(initialState(), "0.5"), [{ action: "secondary" }, { action: "sine" }]);
    assert.equal(result.state.current, "30");
    assert.equal(result.state.secondary, false);
    assert.deepEqual(result.history, ["asen(0.5) = 30"]);
  });

  test("sen⁻¹ de negativo em DEG: -0.5, 2nd, sen resulta em -30", () => {
    const result = run(showResult(initialState(), "-0.5"), [{ action: "secondary" }, { action: "sine" }]);
    assert.equal(result.state.current, "-30");
    assert.deepEqual(result.history, ["asen(-0.5) = -30"]);
  });

  test("sen⁻¹ aceita os limites −1 e 1 (−90° e 90°): -1, 2nd, sen resulta em -90", () => {
    const result = run(showResult(initialState(), "-1"), [{ action: "secondary" }, { action: "sine" }]);
    assert.equal(result.state.current, "-90");
    assert.deepEqual(result.history, ["asen(-1) = -90"]);
  });

  test("sen⁻¹ em RAD: DEG→RAD, 0.5, 2nd, sen resulta em 0.52359878 (π/6)", () => {
    const result = run(showResult(initialState(), "0.5"), [
      { action: "angle-unit" },
      { action: "secondary" },
      { action: "sine" },
    ]);
    assert.equal(result.state.current, "0.52359878");
    assert.deepEqual(result.history, ["asen(0.5) = 0.52359878"]);
  });

  test("sen⁻¹ fora de −1 a 1 em RAD também mostra Erro e não grava histórico: DEG→RAD, 1,5, 2nd, sen resulta em Erro", () => {
    const result = run(showResult(initialState(), "1.5"), [
      { action: "angle-unit" },
      { action: "secondary" },
      { action: "sine" },
    ]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("cos⁻¹ em DEG: 0.5, 2nd, cos resulta em 60 e a linha acos(0.5) = 60", () => {
    const result = run(showResult(initialState(), "0.5"), [{ action: "secondary" }, { action: "cos" }]);
    assert.equal(result.state.current, "60");
    assert.deepEqual(result.history, ["acos(0.5) = 60"]);
  });

  test("cos⁻¹ aceita os limites −1 e 1: 1, 2nd, cos resulta em 0 e -1, 2nd, cos resulta em 180", () => {
    const zero = run(showResult(initialState(), "1"), [{ action: "secondary" }, { action: "cos" }]);
    assert.equal(zero.state.current, "0");
    const straight = run(showResult(initialState(), "-1"), [{ action: "secondary" }, { action: "cos" }]);
    assert.equal(straight.state.current, "180");
    assert.deepEqual(straight.history, ["acos(-1) = 180"]);
  });

  test("cos⁻¹ em RAD: DEG→RAD, 0, 2nd, cos resulta em 1.57079633 (π/2)", () => {
    const result = run(showResult(initialState(), "0"), [
      { action: "angle-unit" },
      { action: "secondary" },
      { action: "cos" },
    ]);
    assert.equal(result.state.current, "1.57079633");
    assert.deepEqual(result.history, ["acos(0) = 1.57079633"]);
  });

  test("cos⁻¹ de −2 (fora do domínio) em DEG e RAD mostra Erro: -2, 2nd, cos resulta em Erro, e o mesmo em RAD", () => {
    const deg = run(showResult(initialState(), "-2"), [{ action: "secondary" }, { action: "cos" }]);
    assert.equal(deg.state.current, "Erro");
    assert.deepEqual(deg.history, []);
    const rad = run(showResult(initialState(), "-2"), [
      { action: "angle-unit" },
      { action: "secondary" },
      { action: "cos" },
    ]);
    assert.equal(rad.state.current, "Erro");
    assert.deepEqual(rad.history, []);
  });

  test("tan⁻¹ de número grande em DEG fica perto de 90 e não mostra Erro: 1000, 2nd, tan", () => {
    const result = run(showResult(initialState(), "1000"), [{ action: "secondary" }, { action: "tan" }]);
    const degrees = Number(result.state.current);
    assert.ok(degrees > 89.9 && degrees < 90, result.state.current);
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0], `atan(1000) = ${result.state.current}`);
  });

  test("tan⁻¹ em RAD: DEG→RAD, 1, 2nd, tan resulta em 0.78539816 (π/4)", () => {
    const result = run(showResult(initialState(), "1"), [
      { action: "angle-unit" },
      { action: "secondary" },
      { action: "tan" },
    ]);
    assert.equal(result.state.current, "0.78539816");
    assert.deepEqual(result.history, ["atan(1) = 0.78539816"]);
  });

  test("tan⁻¹ não tem erro de domínio: -1000, 2nd, tan dá um valor perto de -90, não Erro", () => {
    const result = run(showResult(initialState(), "-1000"), [{ action: "secondary" }, { action: "tan" }]);
    const degrees = Number(result.state.current);
    assert.ok(degrees < -89.9 && degrees > -90, result.state.current);
  });

  test("com Erro no visor, 2nd + cos mantém o Erro e não grava histórico: sen⁻¹(2) → Erro; depois 2nd, cos", () => {
    const erro = run(showResult(initialState(), "2"), [{ action: "secondary" }, { action: "sine" }]);
    assert.equal(erro.state.current, "Erro");
    const depois = run(erro.state, [{ action: "secondary" }, { action: "cos" }]);
    assert.equal(depois.state.current, "Erro");
    assert.deepEqual(depois.history, []);
  });
});

describe("CALC-53: o registro de ações é a única fonte de botões e teclas", () => {
  test("cada id e cada tecla aparecem em uma só entrada", () => {
    const ids = ACTIONS.map((action) => action.id);
    assert.equal(new Set(ids).size, ids.length);
    const keys = ACTIONS.flatMap((action) => action.keys ?? []);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("os data-action e data-value do HTML final são exatamente os ids do registro", () => {
    const htmlIds = [...INDEX_HTML.matchAll(/data-(?:action|value)="([^"]+)"/g)].map((match) => match[1]);
    const registryIds = ACTIONS.map((action) => action.id);
    assert.deepEqual([...new Set(htmlIds)].sort(), [...registryIds].sort());
  });

  test("cada buttonId é um botão de index.html com o data-action da própria entrada", () => {
    for (const action of ACTIONS.filter((item) => item.buttonId !== undefined)) {
      assert.match(
        INDEX_HTML,
        new RegExp(`<button[^>]*id="${action.buttonId}"[^>]*data-action="${action.id}"`),
        `botão ${action.buttonId}`,
      );
    }
  });

  test("uma função unária do registro é aplicada por handleButton: √x de 16 resulta em 4", () => {
    const result = run(showResult(initialState(), "16"), [{ action: "sqrt" }]);
    assert.equal(result.state.current, "4");
    assert.deepEqual(result.history, ["√16 = 4"]);
  });

  test("dígito com data-action (tipo errado) não faz nada: { action: 7 } devolve o mesmo visor", () => {
    const result = handleButton(initialState(), { action: "7" });
    assert.equal(result.state.current, "0");
    assert.deepEqual(result.history, []);
  });
});

// Atalhos para montar sequências de botões no estilo do registro: dígitos e ponto como data-value, o resto como data-action.
const EXP = { action: "exp" };
const NEG = { action: "toggle-sign" };
const SUB = { action: "subtract" };
const EQ = { action: "equals" };

describe("CALC-68: EXP (×10ˣ) digita números grandes e pequenos", () => {
  test("1,5 EXP 3 resulta em 1500 (sem linha de histórico enquanto não há conta)", () => {
    const result = run(initialState(), [{ value: "1" }, { value: "." }, { value: "5" }, EXP, { value: "3" }]);
    assert.equal(result.state.current, "1500");
    assert.deepEqual(result.history, []);
  });

  test("1,5 EXP 3 × 2 = resulta em 3000 e grava 1500 × 2 = 3000", () => {
    const result = run(initialState(), [
      { value: "1" },
      { value: "." },
      { value: "5" },
      EXP,
      { value: "3" },
      { action: "multiply" },
      { value: "2" },
      EQ,
    ]);
    assert.equal(result.state.current, "3000");
    assert.deepEqual(result.history, ["1500 × 2 = 3000"]);
  });

  test("expoente negativo com o sinal de subtrair logo após EXP: 1,5 EXP − 3 resulta em 0.0015", () => {
    const result = run(initialState(), [{ value: "1" }, { value: "." }, { value: "5" }, EXP, SUB, { value: "3" }]);
    assert.equal(result.state.current, "0.0015");
  });

  test("expoente negativo com +/-: 1,5 EXP 3 +/- resulta em 0.0015", () => {
    const result = run(initialState(), [{ value: "1" }, { value: "." }, { value: "5" }, EXP, { value: "3" }, NEG]);
    assert.equal(result.state.current, "0.0015");
  });

  test("mantissa negativa: 1,5 +/- EXP 3 resulta em -1500", () => {
    const result = run(initialState(), [{ value: "1" }, { value: "." }, { value: "5" }, NEG, EXP, { value: "3" }]);
    assert.equal(result.state.current, "-1500");
  });

  test("valor pequeno sai em notação científica: 1,5 EXP − 9 resulta em 1.5E-9", () => {
    const result = run(initialState(), [{ value: "1" }, { value: "." }, { value: "5" }, EXP, SUB, { value: "9" }]);
    assert.equal(result.state.current, "1.5E-9");
  });

  test("valor grande sai em notação científica: 1 EXP 20 resulta em 1E+20", () => {
    const result = run(initialState(), [{ value: "1" }, EXP, { value: "2" }, { value: "0" }]);
    assert.equal(result.state.current, "1E+20");
  });

  test("valor grande com mantissa: 6,02 EXP 23 resulta em 6.02E+23", () => {
    const result = run(initialState(), [
      { value: "6" },
      { value: "." },
      { value: "0" },
      { value: "2" },
      EXP,
      { value: "2" },
      { value: "3" },
    ]);
    assert.equal(result.state.current, "6.02E+23");
  });

  test("limite de 2^53 ainda é plano: 1 EXP 15 resulta em 1000000000000000 (sem notação científica)", () => {
    const result = run(initialState(), [{ value: "1" }, EXP, { value: "1" }, { value: "5" }]);
    assert.equal(result.state.current, "1000000000000000");
  });

  test("limite pequeno: 1 EXP − 6 resulta em 0.000001, e 1 EXP − 7 resulta em 1E-7", () => {
    const six = run(initialState(), [{ value: "1" }, EXP, SUB, { value: "6" }]);
    assert.equal(six.state.current, "0.000001");
    const seven = run(initialState(), [{ value: "1" }, EXP, SUB, { value: "7" }]);
    assert.equal(seven.state.current, "1E-7");
  });

  test("zero continua zero: 0,0 EXP 5 resulta em 0", () => {
    const result = run(initialState(), [{ value: "0" }, { value: "." }, { value: "0" }, EXP, { value: "5" }]);
    assert.equal(result.state.current, "0");
  });

  test("EXP sem número antes é ignorado: EXP com visor 0, depois 5 resulta em 5", () => {
    const result = run(initialState(), [EXP, { value: "5" }]);
    assert.equal(result.state.current, "5");
  });

  test("EXP logo após operador é ignorado: 2 + EXP 3 = resulta em 5", () => {
    const result = run(initialState(), [{ value: "2" }, { action: "add" }, EXP, { value: "3" }, EQ]);
    assert.equal(result.state.current, "5");
    assert.deepEqual(result.history, ["2 + 3 = 5"]);
  });

  test("EXP logo após o igual é ignorado: 2 + 3 = EXP resulta em 5", () => {
    const result = run(initialState(), [{ value: "2" }, { action: "add" }, { value: "3" }, EQ, EXP]);
    assert.equal(result.state.current, "5");
  });

  test("EXP com Erro no visor é ignorado: 5 ÷ 0 = EXP mantém o Erro", () => {
    const result = run(initialState(), [{ value: "5" }, { action: "divide" }, { value: "0" }, EQ, EXP]);
    assert.equal(result.state.current, "Erro");
  });

  test("EXP com EXP já aberto é ignorado: 1 EXP 2 EXP 3 resulta em 1E+23", () => {
    const result = run(initialState(), [{ value: "1" }, EXP, { value: "2" }, EXP, { value: "3" }]);
    assert.equal(result.state.current, "1E+23");
  });

  test("o expoente tem no máximo 3 algarismos: 1 EXP 1234 resulta em 1E+123", () => {
    const result = run(initialState(), [
      { value: "1" },
      EXP,
      { value: "1" },
      { value: "2" },
      { value: "3" },
      { value: "4" },
    ]);
    assert.equal(result.state.current, "1E+123");
  });

  test("o ponto é ignorado enquanto o expoente é digitado: 1 EXP 2 . 5 resulta em 1E+25", () => {
    const result = run(initialState(), [{ value: "1" }, EXP, { value: "2" }, { value: "." }, { value: "5" }]);
    assert.equal(result.state.current, "1E+25");
  });

  test("expoente que estoura o double mostra Erro: 1 EXP 4 0 0 resulta em Erro", () => {
    const result = run(initialState(), [{ value: "1" }, EXP, { value: "4" }, { value: "0" }, { value: "0" }]);
    assert.equal(result.state.current, "Erro");
    assert.deepEqual(result.history, []);
  });

  test("operador fecha o expoente e o próximo dígito começa número novo: 1,5 EXP 3 + 5 = resulta em 1505", () => {
    const result = run(initialState(), [
      { value: "1" },
      { value: "." },
      { value: "5" },
      EXP,
      { value: "3" },
      { action: "add" },
      { value: "5" },
      EQ,
    ]);
    assert.equal(result.state.current, "1505");
    assert.deepEqual(result.history, ["1500 + 5 = 1505"]);
  });

  test("conta acima de 2^53 com um número de EXP continua Erro: 1,5 EXP 20 + 1 = resulta em Erro", () => {
    const result = run(initialState(), [
      { value: "1" },
      { value: "." },
      { value: "5" },
      EXP,
      { value: "2" },
      { value: "0" },
      { action: "add" },
      { value: "1" },
      EQ,
    ]);
    assert.equal(result.state.current, "Erro");
  });

  test("backspace apaga o expoente aos poucos: 1,5 EXP 3 4 → 1.5E+34, depois 1500, depois 1.5", () => {
    let state = run(initialState(), [
      { value: "1" },
      { value: "." },
      { value: "5" },
      EXP,
      { value: "3" },
      { value: "4" },
    ]).state;
    assert.equal(state.current, "1.5E+34");
    state = deleteDigit(state);
    assert.equal(state.current, "1500");
    state = deleteDigit(state);
    assert.equal(state.current, "1.5");
    assert.equal(state.exponent.digits, "");
    state = deleteDigit(state);
    assert.equal(state.exponent, null);
    assert.equal(state.current, "1.5");
  });

  test("handleButton com EXP aberto não altera o estado recebido: 1,5 EXP, depois 3 e +/- trabalham numa cópia", () => {
    const before = run(initialState(), [{ value: "1" }, { value: "." }, { value: "5" }, EXP]).state;
    const snapshot = JSON.stringify(before);
    const typed = handleButton(before, { value: "3" });
    const negated = handleButton(before, NEG);
    assert.equal(typed.state.current, "1500");
    assert.equal(negated.state.exponent.sign, -1);
    assert.equal(JSON.stringify(before), snapshot);
  });
});

describe("CALC-67: Ans insere o último resultado calculado", () => {
  test("Ans sem resultado anterior insere 0: Ans resulta em 0 e não grava histórico", () => {
    const result = run(initialState(), [{ action: "ans" }]);
    assert.equal(result.state.current, "0");
    assert.deepEqual(result.history, []);
  });

  test("Ans depois de = insere o resultado: 2 + 3 =, Ans resulta em 5", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { action: "ans" },
    ]);
    assert.equal(result.state.current, "5");
  });

  test("Ans como operando: 2 + 3 =, + Ans = resulta em 10 e grava 5 + 5 = 10", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { action: "add" },
      { action: "ans" },
      { action: "equals" },
    ]);
    assert.equal(result.state.current, "10");
    assert.deepEqual(result.history, ["2 + 3 = 5", "5 + 5 = 10"]);
  });

  test("Ans substitui o número digitado: 2 + 3 =, 7, Ans resulta em 5", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { value: "7" },
      { action: "ans" },
    ]);
    assert.equal(result.state.current, "5");
  });

  test("resultado de função unária conta como último resultado: 16, √x, Ans resulta em 4", () => {
    const result = run(showResult(initialState(), "16"), [{ action: "sqrt" }, { value: "9" }, { action: "ans" }]);
    assert.equal(result.state.current, "4");
    assert.deepEqual(result.history, ["√16 = 4"]);
  });

  test("Erro não substitui o último resultado: 2 + 3 =, 5 ÷ 0 =, Ans resulta em 5", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { value: "5" },
      { action: "divide" },
      { value: "0" },
      { action: "equals" },
      { action: "ans" },
    ]);
    assert.equal(result.state.current, "5");
    assert.equal(result.state.error, false);
  });

  test("= sem conta depois de AC não sobrescreve o último resultado: 2 + 3 =, AC, =, Ans resulta em 5", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { action: "all-clear" },
      { action: "equals" },
      { action: "ans" },
    ]);
    assert.equal(result.state.current, "5");
  });

  test("AC não apaga o último resultado: 2 + 3 =, AC, Ans resulta em 5", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { action: "all-clear" },
      { action: "ans" },
    ]);
    assert.equal(result.state.current, "5");
  });

  test("Ans sobre Erro começa uma calculadora nova com o último resultado: 2 + 3 =, 5 ÷ 0 =, Ans resulta em 5 sem Erro", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { value: "5" },
      { action: "divide" },
      { value: "0" },
      { action: "equals" },
      { action: "ans" },
    ]);
    assert.equal(result.state.current, "5");
    assert.equal(result.state.error, false);
  });
});
