// Testes do teclado gerado a partir do registro ACTIONS (src/keypad.js, CALC-59): ordem, contagem, rótulos e os contêineres do documento.
// Sem DOM: o módulo gera o HTML como texto, e renderKeypad recebe um documento mínimo.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ACTIONS } from "../src/calculator.js";
import { fillKeypadMarkup, keypadMarkup, renderKeypad } from "../src/keypad.js";

// angle-unit (DEG) fica estático na barra de status de index.html, fora dos dois contêineres gerados.
const STATIC_IN_STATUS_BAR = ["angle-unit"];

// Ids (id="...") de todos os botões de um trecho de HTML, na ordem em que aparecem.
function buttonIds(markup) {
  return [...markup.matchAll(/<button[^>]*?\sid="([^"]+)"/g)].map((match) => match[1]);
}

// Valores de data-value e data-action de todos os botões de um trecho, na ordem em que aparecem.
function buttonValues(markup) {
  return [...markup.matchAll(/data-(?:value|action)="([^"]+)"/g)].map((match) => match[1]);
}

describe("CALC-59: a linha de funções vem do registro, na ordem da tela", () => {
  test("os 18 botões com buttonId aparecem na ordem MC, MR, M+, M-, x², log, ln, sen, cos, tan, xʸ, π, e, 1/x, x!, √x, (, )", () => {
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
      "inverse-button",
      "factorial-button",
      "sqrt-button",
      "open-paren-button",
      "close-paren-button",
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

describe("CALC-59: o teclado numérico e a linha de funções cobrem o registro sem repetição", () => {
  test("o teclado tem 19 botões e a linha de funções 18: 37 no total, um por ação do registro exceto angle-unit", () => {
    const { scientific, keypad } = keypadMarkup();
    assert.equal((keypad.match(/<button /g) ?? []).length, 19);
    assert.equal((scientific.match(/<button /g) ?? []).length, 18);
    const generated = buttonValues(scientific + keypad).sort();
    const generatedActions = ACTIONS.map((action) => action.id)
      .filter((id) => !STATIC_IN_STATUS_BAR.includes(id))
      .sort();
    assert.deepEqual(generated, generatedActions);
  });

  test("o botão de ponto usa data-value e aria-label do registro: <button ... data-value=\".\" aria-label=\"Ponto decimal\">.</button>", () => {
    assert.ok(
      keypadMarkup().keypad.includes(
        '<button type="button" class="btn btn-digit" data-value="." aria-label="Ponto decimal">.</button>',
      ),
    );
  });

  test("0 leva a classe btn-zero e os dígitos não têm aria-label (o rótulo visível já é o nome)", () => {
    const { keypad } = keypadMarkup();
    assert.ok(keypad.includes('<button type="button" class="btn btn-digit btn-zero" data-value="0">0</button>'));
    assert.ok(keypad.includes('<button type="button" class="btn btn-digit" data-value="7">7</button>'));
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
