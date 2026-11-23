// Testes do teclado gerado a partir do registro ACTIONS (src/keypad.js, CALC-59 e grade 4x5 de CALC-24): ordem, grade, contagem, rótulos e os contêineres do documento.
// Sem DOM: o módulo gera o HTML como texto, e renderKeypad recebe um documento mínimo.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src/ são scripts clássicos (sem import/export): calculator.js e keypad.js entram no mesmo escopo, na ordem de index.html.
const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
function carregarScripts(arquivos, nomes) {
  const codigo = arquivos.map((arquivo) => fs.readFileSync(path.join(SRC_DIR, arquivo), "utf8")).join("\n;\n");
  return new Function(`${codigo}\nreturn { ${nomes.join(", ")} };`)();
}
const { ACTIONS, fillKeypadMarkup, keypadMarkup, renderKeypad } = carregarScripts(
  ["calculator.js", "keypad.js"],
  ["ACTIONS", "fillKeypadMarkup", "keypadMarkup", "renderKeypad"],
);

// angle-unit (DEG) e secondary (2nd, CALC-69) ficam estáticos na barra de status de index.html, fora dos dois contêineres gerados.
const STATIC_IN_STATUS_BAR = ["angle-unit", "secondary"];

// open-paren e close-paren são só as teclas ( e ) do teclado físico; na tela o botão é o ( ), paren-toggle (CALC-24).
const KEY_ONLY = ["open-paren", "close-paren"];

// Ids (id="...") de todos os botões de um trecho de HTML, na ordem em que aparecem.
function buttonIds(markup) {
  return [...markup.matchAll(/<button[^>]*?\sid="([^"]+)"/g)].map((match) => match[1]);
}

// Valores de data-value e data-action de todos os botões de um trecho, na ordem em que aparecem.
function buttonValues(markup) {
  return [...markup.matchAll(/data-(?:value|action)="([^"]+)"/g)].map((match) => match[1]);
}

// Rótulo visível de cada botão de um trecho, na ordem da tela (ordem do HTML).
function visibleLabels(markup) {
  return [...markup.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((match) => match[1]);
}

describe("CALC-59: a linha de funções vem do registro, na ordem da tela", () => {
  test("os 19 botões com buttonId aparecem na ordem MC, MR, M+, M-, x², log, ln, sen, cos, tan, xʸ, π, e, EXP, 1/x, x!, √x, Ans, ⌫", () => {
    assert.deepEqual(buttonIds(keypadMarkup().scientific), [
      "memory-clear",
      "memory-recall",
      "memory-add",
      "memory-subtract",
      "square-button",
      "log-button",
      "ln-button",
      "sine-button",
      "cos-button",
      "tan-button",
      "power-button",
      "pi-button",
      "e-button",
      "exp-button",
      "inverse-button",
      "factorial-button",
      "sqrt-button",
      "ans-button",
      "backspace-button",
    ]);
  });

  test("cada botão da linha de funções tem o buttonId da própria ação do registro", () => {
    const withButtonId = ACTIONS.filter(
      (action) => action.buttonId !== undefined && !STATIC_IN_STATUS_BAR.includes(action.id),
    );
    assert.equal(buttonIds(keypadMarkup().scientific).length, withButtonId.length);
    for (const action of withButtonId) {
      assert.match(
        keypadMarkup().scientific,
        new RegExp(`<button type="button" id="${action.buttonId}" class="[^"]+" data-action="${action.id}"`),
      );
    }
  });
});

describe("CALC-24: teclado numérico em grade 4x5, na ordem da referência", () => {
  test("os 20 botões saem em 5 linhas de 4: C ( ) % ÷ / 7 8 9 × / 4 5 6 − / 1 2 3 + / +/- 0 . =", () => {
    assert.deepEqual(visibleLabels(keypadMarkup().keypad), [
      "AC",
      "( )",
      "%",
      "÷",
      "7",
      "8",
      "9",
      "×",
      "4",
      "5",
      "6",
      "−",
      "1",
      "2",
      "3",
      "+",
      "+/-",
      "0",
      ".",
      "=",
    ]);
  });

  test("nenhum botão ocupa duas colunas: o 0 não tem btn-zero e sai como os outros dígitos", () => {
    const { keypad } = keypadMarkup();
    assert.doesNotMatch(keypad, /btn-zero/);
    assert.ok(keypad.includes('<button type="button" class="btn btn-digit" data-value="0">0</button>'));
  });

  test("( ) é um botão só, com rótulo visível e nome que traz o símbolo, e não há botões separados para ( e )", () => {
    const { keypad, scientific } = keypadMarkup();
    assert.ok(
      keypad.includes(
        '<button type="button" class="btn btn-function" data-action="paren-toggle" aria-label="Parênteses: abrir ou fechar ( )">( )</button>',
      ),
    );
    assert.doesNotMatch(keypad + scientific, /data-action="(open|close)-paren"/);
  });

  test("( ) não tem id: o clique já chega pela delegação do teclado numérico, e um id dispararia a ação duas vezes", () => {
    assert.doesNotMatch(keypadMarkup().keypad, /id="paren-toggle-button"/);
  });

  test("⌫ sai na linha de funções, com id e aria-label, e não no teclado numérico", () => {
    assert.ok(
      keypadMarkup().scientific.includes(
        '<button type="button" id="backspace-button" class="backspace-add" data-action="backspace" aria-label="Apagar último dígito (⌫, Backspace)">⌫</button>',
      ),
    );
    assert.doesNotMatch(keypadMarkup().keypad, /data-action="backspace"/);
  });
});

describe("CALC-59: o teclado numérico e a linha de funções cobrem o registro sem repetição", () => {
  test("o teclado tem 20 botões e a linha de funções 19: 39 no total, um por ação do registro exceto angle-unit, secondary, ( e )", () => {
    const { scientific, keypad } = keypadMarkup();
    assert.equal((keypad.match(/<button /g) ?? []).length, 20);
    assert.equal((scientific.match(/<button /g) ?? []).length, 19);
    const generated = buttonValues(scientific + keypad).sort();
    const generatedActions = ACTIONS.map((action) => action.id)
      .filter((id) => !STATIC_IN_STATUS_BAR.includes(id) && !KEY_ONLY.includes(id))
      .sort();
    assert.deepEqual(generated, generatedActions);
  });

  test("o botão de ponto usa data-value e aria-label do registro: <button ... data-value=\".\" aria-label=\"Ponto decimal (.)\">.</button>", () => {
    assert.ok(
      keypadMarkup().keypad.includes(
        '<button type="button" class="btn btn-digit" data-value="." aria-label="Ponto decimal (.)">.</button>',
      ),
    );
  });

  test("CALC-74: o nome acessível de cada botão contém o rótulo visível (WCAG 2.5.3), no teclado e na linha de funções", () => {
    const markup = keypadMarkup().scientific + keypadMarkup().keypad;
    const named = [...markup.matchAll(/aria-label="([^"]+)"[^>]*>([^<]+)<\/button>/g)];
    // Os 19 da linha de funções têm aria-label; no teclado, só os que não são dígitos (AC, ( ), %, ÷, ×, −, +, +/-, ., =).
    assert.equal(named.length, 29, `${named.length} botões com aria-label`);
    for (const [, name, visible] of named) {
      assert.ok(name.includes(visible), `"${name}" não contém o rótulo visível "${visible}"`);
    }
  });

  test("os dígitos não têm aria-label (o rótulo visível já é o nome)", () => {
    const { keypad } = keypadMarkup();
    assert.ok(keypad.includes('<button type="button" class="btn btn-digit" data-value="7">7</button>'));
  });

  test("Ans da linha de funções sai com id, classe, data-action, aria-label e o rótulo do registro (CALC-67)", () => {
    assert.ok(
      keypadMarkup().scientific.includes(
        '<button type="button" id="ans-button" class="ans-add" data-action="ans" aria-label="Último resultado (Ans)">Ans</button>',
      ),
    );
  });

  test("MC da linha de funções sai com id, classe, data-action, aria-label e o rótulo do registro", () => {
    assert.ok(
      keypadMarkup().scientific.includes(
        '<button type="button" id="memory-clear" class="memory-clear" data-action="memory-clear" aria-label="Limpar memória (MC)">MC</button>',
      ),
    );
  });
});

describe("CALC-59: o HTML final e o documento recebem o teclado gerado", () => {
  test("fillKeypadMarkup põe o markup nas duas colunas vazias de index.html", () => {
    const html = fillKeypadMarkup('<div class="scientific"></div>\n<div class="keypad"></div>');
    assert.ok(html.includes('<div class="scientific"><button type="button" id="memory-clear"'));
    assert.ok(html.includes('<div class="keypad"><button type="button" class="btn btn-function" data-action="all-clear"'));
  });

  test("renderKeypad preenche os dois contêineres do documento", () => {
    const scientific = { innerHTML: "" };
    const keypad = { innerHTML: "" };
    const elements = { ".scientific": scientific, ".keypad": keypad };
    renderKeypad({ querySelector: (selector) => elements[selector] ?? null });
    assert.equal(scientific.innerHTML, keypadMarkup().scientific);
    assert.equal(keypad.innerHTML, keypadMarkup().keypad);
  });

  test("renderKeypad sem os contêineres não falha", () => {
    assert.doesNotThrow(() => renderKeypad({ querySelector: () => null }));
  });
});
