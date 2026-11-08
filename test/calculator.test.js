// Testes do motor de cálculo (src/calculator.js) importado direto no Node, sem DOM: as ações recebem e devolvem o estado.
// Os testes de ponta a ponta com o DOM mínimo ficam em calculadora.test.js.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deleteDigit, handleButton, initialState, showResult } from "../src/calculator.js";

const CALCULATOR_SOURCE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "calculator.js"),
  "utf8",
);

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
