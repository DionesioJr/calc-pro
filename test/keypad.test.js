// Testes do teclado gerado a partir do registro ACTIONS (src/keypad.js, CALC-59): ordem, contagem, rótulos e os contêineres do documento.
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

// Ids (id="...") de todos os botões de um trecho de HTML, na ordem em que aparecem.
function buttonIds(markup) {
  return [...markup.matchAll(/<button[^>]*?\sid="([^"]+)"/g)].map((match) => match[1]);
}

// Valores de data-value e data-action de todos os botões de um trecho, na ordem em que aparecem.
function buttonValues(markup) {
  return [...markup.matchAll(/data-(?:value|action)="([^"]+)"/g)].map((match) => match[1]);
}

describe("CALC-59: a linha de funções vem do registro, na ordem da tela", () => {
  test("os 18 botões com buttonId aparecem na ordem MC, MR, M+, M-, x², log, ln, sen, cos, tan, xʸ, π, e, EXP, 1/x, x!, √x, Ans (sem ( e ), que saíram, CALC-28)", () => {
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

// Ações que só têm tecla física, sem botão na tela (CALC-28): AC (Escape), ⌫ (Backspace), ( e ).
const KEYBOARD_ONLY = ["all-clear", "backspace", "open-paren", "close-paren"];

describe("CALC-59: o teclado numérico e a linha de funções cobrem o registro sem repetição", () => {
  test("o teclado tem 20 botões (com C e ( ), a linha de funções 18 (com EXP e Ans): 38 no total, um por ação do registro com botão, exceto angle-unit, secondary e as só de teclado", () => {
    const { scientific, keypad } = keypadMarkup();
    assert.equal((keypad.match(/<button /g) ?? []).length, 20);
    assert.equal((scientific.match(/<button /g) ?? []).length, 18);
    const generated = buttonValues(scientific + keypad).sort();
    const generatedActions = ACTIONS.map((action) => action.id)
      .filter((id) => !STATIC_IN_STATUS_BAR.includes(id) && !KEYBOARD_ONLY.includes(id))
      .sort();
    assert.deepEqual(generated, generatedActions);
  });

  test("AC, ⌫, ( e ) não têm botão na tela: continuam só como tecla física (CALC-28)", () => {
    const { scientific, keypad } = keypadMarkup();
    for (const id of KEYBOARD_ONLY) {
      assert.doesNotMatch(scientific + keypad, new RegExp(`data-action="${id}"`));
    }
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
    // Os 18 da linha de funções têm aria-label; no teclado, os 10 que não são dígitos (C, +/-, %, operadores, =, ponto e ( )).
    assert.ok(named.length >= 28, `só ${named.length} botões com aria-label`);
    for (const [, name, visible] of named) {
      assert.ok(name.includes(visible), `"${name}" não contém o rótulo visível "${visible}"`);
    }
  });

  test("0 leva a classe btn-zero e os dígitos não têm aria-label (o rótulo visível já é o nome)", () => {
    const { keypad } = keypadMarkup();
    assert.ok(keypad.includes('<button type="button" class="btn btn-digit btn-zero" data-value="0">0</button>'));
    assert.ok(keypad.includes('<button type="button" class="btn btn-digit" data-value="7">7</button>'));
  });

  test("o C fica no lugar do AC, no início do teclado, com aria-label que traz o símbolo (CALC-28)", () => {
    assert.ok(
      keypadMarkup().keypad.startsWith(
        '<button type="button" class="btn btn-function" data-action="clear-entry" aria-label="Limpar entrada (C)">C</button>',
      ),
    );
  });

  test("o ( ) é o último botão do teclado, no lugar do ⌫, com aria-label que traz o símbolo (CALC-28)", () => {
    assert.ok(
      keypadMarkup().keypad.endsWith(
        '<button type="button" class="btn btn-function" data-action="paren-toggle" aria-label="Abrir ou fechar parêntese ( )">( )</button>',
      ),
    );
  });

  test("⌫ não tem botão no teclado de toque, mas a ação segue com a tecla Backspace (CALC-28)", () => {
    assert.doesNotMatch(keypadMarkup().keypad, /data-action="backspace"/);
    const action = ACTIONS.find((item) => item.id === "backspace");
    assert.deepEqual(action.keys, ["Backspace"]);
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
    assert.ok(html.includes('<div class="keypad"><button type="button" class="btn btn-function" data-action="clear-entry"'));
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
