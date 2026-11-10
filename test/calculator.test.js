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

  test("⌫ devolve um estado novo e apaga o último dígito do estado recebido: 12 vira 1", () => {
    // 12 chega pela digitação, para o número ser editável (o estado montado à mão não passaria pela flag typing).
    const before = run(initialState(), [{ value: "1" }, { value: "2" }]).state;
    const result = handleButton(before, { action: "backspace" });
    assert.equal(result.state.current, "1");
    assert.equal(before.current, "12");
  });

  test("M+ grava o visor na memória do estado devolvido: 5, M+ resulta em memória 5", () => {
    const result = run(initialState(), [{ value: "5" }, { action: "memory-add" }]);
    assert.equal(result.state.memory, 5);
  });
});

describe("CALC-65: ⌫ apaga o último dígito e não mexe em resultado nem em erro", () => {
  test("⌫ está no registro com a tecla Backspace e o rótulo ⌫", () => {
    const action = ACTIONS.find((item) => item.id === "backspace");
    assert.equal(action.label, "⌫");
    assert.deepEqual(action.keys, ["Backspace"]);
  });

  test("⌫ com um único dígito volta para 0, e com negativo de um dígito também: 5, ⌫ resulta em 0; -5, ⌫ resulta em 0", () => {
    const digit = run(initialState(), [{ value: "5" }, { action: "backspace" }]);
    assert.equal(digit.state.current, "0");
    const negative = run(initialState(), [{ value: "5" }, { action: "toggle-sign" }, { action: "backspace" }]);
    assert.equal(negative.state.current, "0");
  });

  test("⌫ com Erro no visor mantém o Erro: 5, ÷, 0, = e depois ⌫ resulta em Erro", () => {
    const result = run(initialState(), [
      { value: "5" },
      { action: "divide" },
      { value: "0" },
      { action: "equals" },
      { action: "backspace" },
    ]);
    assert.equal(result.state.current, "Erro");
    assert.equal(result.state.error, true);
  });

  test("⌫ sobre notação científica não muda o resultado: 20 x! e depois ⌫ mantém 2.4329020081766E+18", () => {
    const result = run(initialState(), [{ value: "2" }, { value: "0" }, { action: "factorial" }, { action: "backspace" }]);
    assert.equal(result.state.current, "2.4329020081766E+18");
  });

  test("⌫ sobre o valor de um grupo fechado não muda o valor: (2 + 3) e depois ⌫ mantém 5", () => {
    const result = run(initialState(), [
      { action: "open-paren" },
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "close-paren" },
      { action: "backspace" },
    ]);
    assert.equal(result.state.current, "5");
    assert.equal(result.state.valueIsGroup, true);
  });

  test("⌫ após = não altera o resultado: 2 + 3 = e depois ⌫ mantém 5", () => {
    const result = run(initialState(), [
      { value: "2" },
      { action: "add" },
      { value: "3" },
      { action: "equals" },
      { action: "backspace" },
    ]);
    assert.equal(result.state.current, "5");
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
