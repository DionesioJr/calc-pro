// Testes do motor de cálculo (src/calculator.js) importado direto no Node, sem DOM: as ações recebem e devolvem o estado.
// Os testes de ponta a ponta com o DOM mínimo ficam em calculadora.test.js.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIONS, deleteDigit, handleButton, initialState, showResult } from "../src/calculator.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CALCULATOR_SOURCE = fs.readFileSync(path.join(ROOT, "src", "calculator.js"), "utf8");
const INDEX_HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

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

describe("CALC-53: o registro de ações é a única fonte de botões e teclas", () => {
  test("cada id e cada tecla aparecem em uma só entrada", () => {
    const ids = ACTIONS.map((action) => action.id);
    assert.equal(new Set(ids).size, ids.length);
    const keys = ACTIONS.flatMap((action) => action.keys ?? []);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("os data-action e data-value de index.html são exatamente os ids do registro", () => {
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
