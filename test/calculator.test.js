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
