"use strict";

// Testes da entrada de dígitos e ponto decimal (CALC-4), da lógica de operações (CALC-5),
// de AC/+/-/% (CALC-6), do teclado físico (CALC-8), de erro, limite de dígitos,
// arredondamento e tamanho da fonte (CALC-7), do feedback visual dos botões (CALC-9),
// do limite de 2^53 para resultados (CALC-16), do histórico de cálculos no localStorage (CALC-19),
// do painel de histórico reformulado (CALC-20: itens tocáveis, confirmação ao limpar),
// e do layout mobile com o painel do histórico em tela cheia (CALC-21),
// e do botão M+ com o indicador de memória (CALC-22),
// e do botão x² (CALC-26: eleva o visor ao quadrado, com erro e formatação do visor),
// e da precedência de × e ÷ sobre + e − (CALC-28),
// e do botão sen (CALC-31: seno do visor em graus, com a unidade DEG visível),
// e da unidade angular DEG/RAD do sen e do tan (CALC-41: alterna graus e radianos, com a unidade visível no visor),
// e do botão π (CALC-36: insere pi como operando),
// e do botão e (CALC-37: insere o número de Euler como operando),
// e do botão 1/x (CALC-38: inverso do visor, com Erro para zero),
// e do botão tan (CALC-33: tangente do visor em graus, com Erro em 90° + 180°·k),
// e do botão xʸ (CALC-29: potência binária com precedência sobre × e ÷, associação à direita e Erro para resultado não real),
// e do botão M- (CALC-23: subtrai o visor da memória),
// e do botão MR (CALC-24: copia a memória para o visor como operando),
// e do botão MC (CALC-25: zera a memória e o indicador), e do indicador M no display, no desktop e no mobile (CALC-66),
// e do botão ln (CALC-35: logaritmo natural do visor, com Erro para valor menor ou igual a zero),
// e do botão x! (CALC-39: fatorial do visor, com notação científica acima de 2^53 e Erro para negativo, decimal e overflow),
// e do botão cos (CALC-32: cosseno do visor em graus, sem ruído de ponto flutuante).
// e do botão √x (CALC-27: raiz quadrada do visor, com Erro para negativos),
// e do valor completo de e em √x e cos (CALC-49),
// e dos botões ( e ) (CALC-30: agrupamento com aninhamento, multiplicação implícita e indicador de parênteses abertos),
// e do histórico das funções avançadas (CALC-43: cada função aplicada ao visor vira uma linha, como √16 = 4 ou sen(30) = 0.5),
// e dos atalhos de teclado das funções avançadas (CALC-42: ^ xʸ, p π, ! x!, r MR, c MC, _ M-, e a lista de atalhos na tela),
// e do botão ⌫ e da tecla Backspace (CALC-65: apaga o último dígito; Erro, resultado e notação científica não mudam),
// e da memória e da unidade DEG/RAD guardadas entre sessões, com armazenamento indisponível tratado sem erro (CALC-73).
// Monta os módulos reais de src/ (start de src/main.js) sobre um DOM mínimo, e aperta
// os botões pelo mesmo caminho de clique que o navegador usa; o teclado usa o mesmo
// caminho de keydown.
// Sem dependências: rodar com `npm test` (node --test, Node 18+).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// src/ são scripts clássicos (o navegador os carrega sem import/export): aqui eles entram no mesmo escopo, na ordem de index.html.
// Devolve as funções pedidas em `nomes`.
function carregarScripts(arquivos, nomes) {
  const codigo = arquivos.map((arquivo) => fs.readFileSync(path.join(ROOT, "src", arquivo), "utf8")).join("\n;\n");
  return new Function(`${codigo}\nreturn { ${nomes.join(", ")} };`)();
}
const { start, fillKeypadMarkup } = carregarScripts(
  ["calculator.js", "history.js", "keypad.js", "ui.js", "keyboard.js", "main.js"],
  ["start", "fillKeypadMarkup"],
);
// HTML final: index.html com a linha de funções e o teclado gerados a partir do registro ACTIONS (CALC-59).
const HTML_SOURCE = fillKeypadMarkup(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
// Os arquivos de css/ na ordem em que index.html os carrega: essa ordem é a cascata.
const CSS_FILES = ["tema.css", "display.css", "teclado.css", "historico.css"].map((name) =>
  fs.readFileSync(path.join(ROOT, "css", name), "utf8"),
);
const CSS_SOURCE = CSS_FILES.join("\n");
// Partes antes e depois do corte de 768px, de cada arquivo (cada um tem o seu bloco desktop).
const DESKTOP_MEDIA = "@media (min-width: 768px)";
const CSS_BASE = CSS_FILES.map((css) => css.split(DESKTOP_MEDIA)[0]).join("\n");
const CSS_DESKTOP = CSS_FILES.map((css) => css.split(DESKTOP_MEDIA)[1] ?? "").join("\n");

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
  AC: { action: "all-clear" },
  "⌫": { action: "backspace" },
  "+/-": { action: "toggle-sign" },
  "%": { action: "percent" },
  "+": { action: "add" },
  "−": { action: "subtract" },
  "×": { action: "multiply" },
  "÷": { action: "divide" },
  "=": { action: "equals" },
};

// classList mínimo, com o que os módulos de src/ usam (add, remove, contains).
function createClassList() {
  const names = new Set();
  return {
    add: (...list) => list.forEach((name) => names.add(name)),
    remove: (...list) => list.forEach((name) => names.delete(name)),
    contains: (name) => names.has(name),
  };
}

const DISPLAY_SIZE_CLASSES = ["display-64", "display-48", "display-40"];

// Botão com dataset, classList e atributos (setAttribute/getAttribute), como no navegador.
function createButton(dataset) {
  const attributes = {};
  return {
    dataset,
    classList: createClassList(),
    setAttribute: (name, value) => {
      attributes[name] = String(value);
    },
    getAttribute: (name) => (name in attributes ? attributes[name] : null),
  };
}

// Elemento do DOM mínimo para o histórico: texto, filhos, atributo hidden e listeners.
function createElementMock(tagName) {
  const listeners = {};
  const attributes = {};
  return {
    tagName: tagName.toUpperCase(),
    textContent: "",
    className: "",
    classList: createClassList(),
    hidden: false,
    focused: false,
    inert: false,
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return name in attributes ? attributes[name] : null;
    },
    focus() {
      this.focused = true;
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type) {
      listeners[type]({});
    },
  };
}

// localStorage mínimo, com o mesmo objeto de armazenamento exposto para o teste ler e pré-carregar.
function createLocalStorage(storage) {
  return {
    getItem: (key) => (key in storage ? storage[key] : null),
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
  };
}

// storage: objeto que faz o papel do localStorage; passe o mesmo objeto para simular recarregar a página.
function createCalculator({ storage = {} } = {}) {
  const display = { textContent: "", classList: createClassList() };
  const historyList = createElementMock("ol");
  const historyEmpty = createElementMock("p");
  const historyActions = createElementMock("div");
  const historyClear = createElementMock("button");
  const historyConfirm = createElementMock("div");
  const historyCancel = createElementMock("button");
  const historyConfirmYes = createElementMock("button");
  const historyPanel = createElementMock("section");
  const historyOpenButton = createElementMock("button");
  const historyCloseButton = createElementMock("button");
  const calculatorMain = createElementMock("main");
  // MC fica fora do teclado, antes do MR na linha da memória, como em index.html.
  const memoryClearElement = createElementMock("button");
  memoryClearElement.dataset = { action: "memory-clear" };
  // MR fica fora do teclado, antes do M+ na linha da memória, como em index.html.
  const memoryRecallElement = createElementMock("button");
  memoryRecallElement.dataset = { action: "memory-recall" };
  // M+ fica fora do teclado, como em index.html; o indicador começa escondido, como no HTML.
  const memoryAddElement = createElementMock("button");
  memoryAddElement.dataset = { action: "memory-add" };
  // M- fica ao lado do M+, na linha da memória, como em index.html.
  const memorySubtractElement = createElementMock("button");
  memorySubtractElement.dataset = { action: "memory-subtract" };
  const memoryIndicatorElement = createElementMock("span");
  memoryIndicatorElement.hidden = true;
  // x² também fica fora do teclado, na linha da memória, como em index.html.
  const squareElement = createElementMock("button");
  squareElement.dataset = { action: "square" };
  // log também fica na linha da memória, fora do teclado, como em index.html.
  const logElement = createElementMock("button");
  logElement.dataset = { action: "log" };
  // sen também fica fora do teclado, na linha da memória, como em index.html.
  const sineElement = createElementMock("button");
  sineElement.dataset = { action: "sine" };
  // π também fica fora do teclado, na linha da memória, como em index.html.
  const piElement = createElementMock("button");
  piElement.dataset = { action: "pi" };
  // e também fica fora do teclado, na linha da memória, como em index.html.
  const eElement = createElementMock("button");
  eElement.dataset = { action: "euler" };
  // 1/x também fica fora do teclado, na linha da memória, como em index.html.
  const inverseElement = createElementMock("button");
  inverseElement.dataset = { action: "inverse" };
  // DEG/RAD também fica fora do teclado, na linha da memória, como em index.html.
  const angleUnitElement = createElementMock("button");
  angleUnitElement.dataset = { action: "angle-unit" };
  // x! também fica fora do teclado, na linha da memória, como em index.html.
  const factorialElement = createElementMock("button");
  factorialElement.dataset = { action: "factorial" };
  // cos também fica fora do teclado, na linha da memória, como em index.html.
  const cosineElement = createElementMock("button");
  cosineElement.dataset = { action: "cos" };
  // √x também fica fora do teclado, na linha da memória, como em index.html.
  const squareRootElement = createElementMock("button");
  squareRootElement.dataset = { action: "sqrt" };
  // tan também fica fora do teclado, na linha da memória, como em index.html.
  const tangentElement = createElementMock("button");
  tangentElement.dataset = { action: "tan" };
  // ln também fica fora do teclado, na linha da memória, logo depois do log, como em index.html.
  const lnElement = createElementMock("button");
  lnElement.dataset = { action: "ln" };
  // ( e ) também ficam fora do teclado, na linha da memória, como em index.html.
  const openParenElement = createElementMock("button");
  openParenElement.dataset = { action: "open-paren" };
  const closeParenElement = createElementMock("button");
  closeParenElement.dataset = { action: "close-paren" };
  // Indicador de parênteses começa escondido, como no HTML; símbolos e texto para o leitor de tela.
  const parenIndicatorElement = createElementMock("span");
  parenIndicatorElement.hidden = true;
  const parenSymbolsElement = createElementMock("span");
  const parenTextElement = createElementMock("span");
  // xʸ também fica fora do teclado, na linha da memória, como em index.html.
  const powerElement = createElementMock("button");
  powerElement.dataset = { action: "power" };
  let onKeypadClick = null;
  let onKeyDown = null;
  let onKeyUp = null;
  let onBlur = null;

  // Um botão por tecla de KEY_DATASET; o mesmo objeto é usado pelo clique e pelo querySelectorAll do keypad.
  const buttonByKey = {};
  for (const key of Object.keys(KEY_DATASET)) {
    buttonByKey[key] = createButton(KEY_DATASET[key]);
  }
  const buttons = Object.values(buttonByKey);
  buttonByKey["MC"] = memoryClearElement;
  buttonByKey["MR"] = memoryRecallElement;
  buttonByKey["M+"] = memoryAddElement;
  buttonByKey["M-"] = memorySubtractElement;
  buttonByKey["x²"] = squareElement;
  buttonByKey["log"] = logElement;
  buttonByKey["ln"] = lnElement;
  buttonByKey["sen"] = sineElement;
  buttonByKey["π"] = piElement;
  buttonByKey["e"] = eElement;
  buttonByKey["1/x"] = inverseElement;
  buttonByKey["x!"] = factorialElement;
  buttonByKey["cos"] = cosineElement;
  buttonByKey["√x"] = squareRootElement;
  buttonByKey["tan"] = tangentElement;
  buttonByKey["("] = openParenElement;
  buttonByKey[")"] = closeParenElement;
  buttonByKey["xʸ"] = powerElement;

  const keypad = {
    addEventListener(type, listener) {
      if (type === "click") {
        onKeypadClick = listener;
      }
    },
    querySelectorAll: (selector) => (selector === "button" ? buttons : []),
    contains: (node) => buttons.includes(node),
  };

  const elementsById = {
    display,
    "history-list": historyList,
    "history-empty": historyEmpty,
    "history-actions": historyActions,
    "history-clear": historyClear,
    "history-confirm": historyConfirm,
    "history-cancel": historyCancel,
    "history-confirm-yes": historyConfirmYes,
    "history-panel": historyPanel,
    "history-open": historyOpenButton,
    "history-close": historyCloseButton,
    calculator: calculatorMain,
    "memory-clear": memoryClearElement,
    "memory-recall": memoryRecallElement,
    "memory-add": memoryAddElement,
    "memory-subtract": memorySubtractElement,
    "memory-indicator": memoryIndicatorElement,
    "square-button": squareElement,
    "log-button": logElement,
    "ln-button": lnElement,
    "sine-button": sineElement,
    "pi-button": piElement,
    "e-button": eElement,
    "inverse-button": inverseElement,
    "angle-unit": angleUnitElement,
    "factorial-button": factorialElement,
    "cos-button": cosineElement,
    "sqrt-button": squareRootElement,
    "tan-button": tangentElement,
    "open-paren-button": openParenElement,
    "close-paren-button": closeParenElement,
    "paren-indicator": parenIndicatorElement,
    "paren-symbols": parenSymbolsElement,
    "paren-text": parenTextElement,
    "power-button": powerElement,
  };

  const document = {
    getElementById: (id) => elementsById[id] ?? null,
    querySelector: (selector) => (selector === ".keypad" ? keypad : null),
    createElement: (tagName) => createElementMock(tagName),
    addEventListener(type, listener) {
      if (type === "keydown") {
        onKeyDown = listener;
      } else if (type === "keyup") {
        onKeyUp = listener;
      }
    },
  };

  const window = {
    addEventListener(type, listener) {
      if (type === "blur") {
        onBlur = listener;
      }
    },
  };

  const localStorage = createLocalStorage(storage);
  // Monta a calculadora sobre o DOM mínimo: zera o estado, liga o histórico ao storage e registra os listeners nos mocks.
  const app = start(document, window, localStorage);

  // Aperta as teclas em sequência e devolve o texto final do display. MC, MR, M+, M-, x², log, sen, cos, π, e, 1/x, √x, tan, xʸ e "unidade" (DEG/RAD) são clicados pelo próprio botão, fora do teclado.
  function press(...keys) {
    for (const key of keys) {
      if (key === "unidade") {
        angleUnitElement.dispatch("click");
        continue;
      }
      if (key === "e") {
        eElement.dispatch("click");
        continue;
      }
      if (key === "MC") {
        memoryClearElement.dispatch("click");
        continue;
      }
      if (key === "MR") {
        memoryRecallElement.dispatch("click");
        continue;
      }
      if (key === "M+") {
        memoryAddElement.dispatch("click");
        continue;
      }
      if (key === "M-") {
        memorySubtractElement.dispatch("click");
        continue;
      }
      if (key === "x²") {
        squareElement.dispatch("click");
        continue;
      }
      if (key === "log") {
        logElement.dispatch("click");
        continue;
      }
      if (key === "ln") {
        lnElement.dispatch("click");
        continue;
      }
      if (key === "sen") {
        sineElement.dispatch("click");
        continue;
      }
      if (key === "π") {
        piElement.dispatch("click");
        continue;
      }
      if (key === "1/x") {
        inverseElement.dispatch("click");
        continue;
      }
      if (key === "x!") {
        factorialElement.dispatch("click");
        continue;
      }
      if (key === "cos") {
        cosineElement.dispatch("click");
        continue;
      }
      if (key === "√x") {
        squareRootElement.dispatch("click");
        continue;
      }
      if (key === "tan") {
        tangentElement.dispatch("click");
        continue;
      }
      if (key === "(") {
        openParenElement.dispatch("click");
        continue;
      }
      if (key === ")") {
        closeParenElement.dispatch("click");
        continue;
      }
      if (key === "xʸ") {
        powerElement.dispatch("click");
        continue;
      }
      const button = buttonByKey[key];
      onKeypadClick({ target: { closest: () => button } });
    }
    return display.textContent;
  }

  // Valor guardado na memória (registrador de src/calculator.js).
  function memoryValue() {
    return app.getState().memory;
  }

  // Botão do teclado pela tecla (ex.: "7", "+", "AC").
  function buttonFor(key) {
    return buttonByKey[key];
  }

  // Teclas do keypad que estão destacadas como operador selecionado (aria-pressed="true").
  function selectedOperator() {
    return Object.keys(buttonByKey).filter((key) => buttonByKey[key].getAttribute("aria-pressed") === "true");
  }

  // Solta uma tecla física (keyup); sem código, usa o próprio caractere, como no keydown.
  function keyUp(key, code = key) {
    onKeyUp({ key, code });
  }

  // Janela perde o foco (ex.: alt-tab com tecla segurada).
  function blur() {
    onBlur();
  }

  // Classe de tamanho de fonte que o display tem agora (uma só).
  function fontSizeClass() {
    const active = DISPLAY_SIZE_CLASSES.filter((name) => display.classList.contains(name));
    assert.equal(active.length, 1, "o display deve ter exatamente uma classe de tamanho");
    return active[0];
  }

  // Dispara um keydown do teclado físico e devolve o evento (para checar preventDefault).
  function keyDown(key, modifiers = {}) {
    const event = {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...modifiers,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    onKeyDown(event);
    return event;
  }

  // Digita teclas do teclado físico em sequência e devolve o texto final do display.
  function type(...keys) {
    for (const key of keys) {
      keyDown(key);
    }
    return display.textContent;
  }

  // Itens do histórico na tela, na ordem em que aparecem (do mais recente para o mais antigo), como "12 × 3 = 36".
  function historyItems() {
    return historyList.children.map((item) => {
      const [button] = item.children;
      const [expression, result] = button.children;
      return `${expression.textContent} = ${result.textContent}`;
    });
  }

  // Botão (item) do histórico na posição index, na ordem da tela.
  function historyItemButton(index) {
    return historyList.children[index].children[0];
  }

  // Expressão, resultado e rótulo acessível de um item do histórico.
  function historyItemParts(index) {
    const button = historyItemButton(index);
    const [expression, result] = button.children;
    return {
      expression: expression.textContent,
      result: result.textContent,
      label: button.getAttribute("aria-label"),
    };
  }

  // Toca num item do histórico, como um clique ou toque; devolve o texto do visor.
  function tapHistoryItem(index) {
    historyItemButton(index).dispatch("click");
    return display.textContent;
  }

  // Aperta o botão Limpar histórico, como um clique do mouse (só abre a confirmação).
  function clickClearButton() {
    historyClear.dispatch("click");
  }

  // Aperta Cancelar na confirmação.
  function clickCancel() {
    historyCancel.dispatch("click");
  }

  // Aperta Apagar na confirmação.
  function clickConfirmYes() {
    historyConfirmYes.dispatch("click");
  }

  // Limpar e confirmar, como o usuário faz para apagar o histórico.
  function clickClear() {
    clickClearButton();
    clickConfirmYes();
  }

  // Botão Histórico (mobile) e × do painel, como um toque.
  function tapHistoryOpen() {
    historyOpenButton.dispatch("click");
  }

  function tapHistoryClose() {
    historyCloseButton.dispatch("click");
  }

  return {
    press,
    keyDown,
    keyUp,
    blur,
    type,
    fontSizeClass,
    buttonFor,
    selectedOperator,
    historyItems,
    historyItemButton,
    historyItemParts,
    tapHistoryItem,
    clickClearButton,
    clickCancel,
    clickConfirmYes,
    clickClear,
    tapHistoryOpen,
    tapHistoryClose,
    historyClear,
    panelShown: () => historyPanel.classList.contains("is-open"),
    openButtonExpanded: () => historyOpenButton.getAttribute("aria-expanded"),
    calculatorInert: () => calculatorMain.inert,
    closeButtonFocused: () => historyCloseButton.focused,
    openButtonFocused: () => historyOpenButton.focused,
    historyEmptyHidden: () => historyEmpty.hidden,
    historyListHidden: () => historyList.hidden,
    historyActionsHidden: () => historyActions.hidden,
    clearButtonHidden: () => historyClear.hidden,
    confirmHidden: () => historyConfirm.hidden,
    cancelFocused: () => historyCancel.focused,
    emptyMessageFocused: () => historyEmpty.focused,
    display: () => display.textContent,
    memoryValue,
    memoryIndicatorHidden: () => memoryIndicatorElement.hidden,
    memoryAddFocused: () => memoryAddElement.focused,
    memoryRecallFocused: () => memoryRecallElement.focused,
    memoryClearFocused: () => memoryClearElement.focused,
    // Texto visível do botão DEG/RAD e o rótulo acessível dele.
    angleUnitLabel: () => angleUnitElement.textContent,
    angleUnitName: () => angleUnitElement.getAttribute("aria-label"),
    parenSymbols: () => parenSymbolsElement.textContent,
    parenText: () => parenTextElement.textContent,
    parenIndicatorHidden: () => parenIndicatorElement.hidden,
  };
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

// CALC-55: a camada de interface (ui.js e keyboard.js) só usa do motor o que desenha ou mapeia teclas; a conta fica em calculator.js.
// Scripts clássicos não têm import: os nomes do motor chegam pelo escopo global, então a checagem conta quais deles cada arquivo usa.
describe("CALC-55: ui.js e keyboard.js não fazem conta", () => {
  const UI_SOURCE = fs.readFileSync(path.join(ROOT, "src", "ui.js"), "utf8");
  const KEYBOARD_SOURCE = fs.readFileSync(path.join(ROOT, "src", "keyboard.js"), "utf8");
  const ENGINE_SOURCE = fs.readFileSync(path.join(ROOT, "src", "calculator.js"), "utf8");

  // Nomes que calculator.js declara no nível de topo (const, let ou function).
  const ENGINE_NAMES = [...ENGINE_SOURCE.matchAll(/^(?:const|let|function)\s+(\w+)/gm)].map((match) => match[1]);

  // Nomes do motor usados no código do arquivo (comentários de linha não contam).
  function usedFromEngine(source) {
    const code = source.replace(/\/\/.*$/gm, "");
    return ENGINE_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(code)).sort();
  }

  test("ui.js usa do motor só o que desenha: ACTIONS, OPEN_PAREN, openDepth e trailingOperator", () => {
    assert.deepEqual(usedFromEngine(UI_SOURCE), ["ACTIONS", "OPEN_PAREN", "openDepth", "trailingOperator"]);
  });

  test("keyboard.js usa do motor só o registro de ações e datasetOf", () => {
    assert.deepEqual(usedFromEngine(KEYBOARD_SOURCE), ["ACTIONS", "datasetOf"]);
  });

  test("ui.js e keyboard.js não têm operações aritméticas da calculadora nem a tabela OPERATIONS", () => {
    for (const source of [UI_SOURCE, KEYBOARD_SOURCE]) {
      assert.doesNotMatch(source, /\bOPERATIONS\b/);
      assert.doesNotMatch(source, /\bMath\./);
      assert.doesNotMatch(source, /\btoFixed\b/);
      assert.doesNotMatch(source, /\bparse(Float|Int)\b|\bNumber\(/);
    }
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

  test("2 + 3 × 4 = resulta em 14 (× antes de +, CALC-28)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "×", "4", "="), "14");
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

describe("CALC-6: critérios de aceite de AC, +/- e %", () => {
  test("AC volta o display para 0: 7, 8, AC resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("7", "8", "AC"), "0");
  });

  test("AC limpa a operação pendente: 5, +, AC, 3, = resulta em 3 (e não 8)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "+", "AC", "3", "="), "3");
  });

  test("+/- inverte o sinal: 5, +/- resulta em -5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "+/-"), "-5");
  });

  test("% divide por 100: 50, % resulta em 0.5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "0", "%"), "0.5");
  });
});

describe("CALC-6: casos de borda de AC, +/- e %", () => {
  test("AC após erro limpa o erro: 5, ÷, 0, =, AC resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "=", "AC"), "0");
  });

  test("+/- no zero não mostra -0: 0, +/- resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", "+/-"), "0");
  });

  test("+/- duas vezes volta ao número original: 5, +/-, +/- resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "+/-", "+/-"), "5");
  });

  test("+/- com ponto decimal: 5, ponto, +/- resulta em -5.", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", ".", "+/-"), "-5.");
  });

  test("digitar depois de inverter continua o número: 1, +/-, 2 resulta em -12", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "+/-", "2"), "-12");
  });

  test("+/- depois do operador vira o segundo operando: 5, +, +/-, = resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "+", "+/-", "="), "0");
  });

  test("+/- com operação pendente: 2, +, 3, +/-, = resulta em -1", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "+/-", "="), "-1");
  });

  test("% no zero resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("%"), "0");
  });

  test("% depois do operador vira o segundo operando: 5, +, %, = resulta em 5.25 (5 + 5% de 5, CALC-57)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "+", "%", "="), "5.25");
  });

  test("+/- após erro reinicia a calculadora: 5, ÷, 0, =, +/- resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "=", "+/-"), "0");
  });

  test("% após erro reinicia a calculadora: 5, ÷, 0, =, % resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "=", "%"), "0");
  });
});

describe("CALC-57: critérios de aceite do % em soma e subtração", () => {
  test("100 − 10% resulta em 90 (base é o 100)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "0", "−", "1", "0", "%", "="), "90");
  });

  test("100 + 10% resulta em 110", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "0", "+", "1", "0", "%", "="), "110");
  });

  test("100 × 10% resulta em 10 (multiplicação usa o decimal 0.1)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "0", "×", "1", "0", "%", "="), "10");
  });

  test("100 ÷ 10% resulta em 1000 (divisão usa o decimal 0.1)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "0", "÷", "1", "0", "%", "="), "1000");
  });

  test("10% sozinho resulta em 0.1 (sem operador pendente)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "%"), "0.1");
  });

  test("funciona com decimais: 250 − 12.5% resulta em 218.75", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "5", "0", "−", "1", "2", ".", "5", "%", "="), "218.75");
  });

  test("histórico mostra a expressão convertida: 100 − 10% grava 100 − 10 = 90, não 100 − 0.1", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "0", "0", "−", "1", "0", "%", "=");
    assert.deepEqual(calc.historyItems(), ["100 − 10 = 90"]);
  });

  test("histórico de × continua com o decimal: 100 × 10% grava 100 × 0.1 = 10", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "0", "0", "×", "1", "0", "%", "=");
    assert.deepEqual(calc.historyItems(), ["100 × 0.1 = 10"]);
  });

  test("o visor mostra o valor convertido antes do igual: 100 − 10% mostra 10", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "0", "−", "1", "0", "%"), "10");
  });

  test("a base é o valor acumulado à esquerda: 2 × 3 + 10% resulta em 6.6 (base 6)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "×", "3", "+", "1", "0", "%", "="), "6.6");
  });

  test("% depois de × não usa a base da soma: 2 + 3 × 10% resulta em 2.3 (3 × 0.1)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "1", "0", "%", "="), "2.3");
  });

  test("encadeado, a base é o parcial: 100 + 10% + 10% resulta em 121 (110 + 11)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "0", "+", "1", "0", "%", "+", "1", "0", "%", "="), "121");
    assert.deepEqual(calc.historyItems(), ["100 + 10 + 11 = 121"]);
  });

  test("% no grupo sem operador externo continua decimal: (2 + 3) % resulta em 0.05", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "%"), "0.05");
  });

  test("% dentro de um grupo usa a base do grupo: ( 100 − 10 % ) = resulta em 90", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "1", "0", "0", "−", "1", "0", "%", ")", "="), "90");
  });
});

describe("CALC-8: critérios de aceite do teclado físico", () => {
  test("dígitos e ponto pelo teclado: 7, 8, ponto, 5 resulta em 78.5", () => {
    const calc = createCalculator();
    assert.equal(calc.type("7", "8", ".", "5"), "78.5");
  });

  test("vírgula tem o mesmo efeito do ponto: 7, 8, vírgula, 5 resulta em 78.5", () => {
    const calc = createCalculator();
    assert.equal(calc.type("7", "8", ",", "5"), "78.5");
  });

  test(
    "operadores pelo teclado: 7 + 2 resulta em 9, 7 - 2 resulta em 5, 7 * 2 resulta em 14, 8 / 2 resulta em 4",
    () => {
      assert.equal(createCalculator().type("7", "+", "2", "="), "9");
      assert.equal(createCalculator().type("7", "-", "2", "="), "5");
      assert.equal(createCalculator().type("7", "*", "2", "="), "14");
      assert.equal(createCalculator().type("8", "/", "2", "="), "4");
    },
  );

  test("= e Enter resultam no mesmo valor: 2 + 3 = resulta em 5, 2 + 3 Enter resulta em 5", () => {
    assert.equal(createCalculator().type("2", "+", "3", "="), "5");
    assert.equal(createCalculator().type("2", "+", "3", "Enter"), "5");
  });

  test("Escape limpa tudo como AC: 7, 8, Escape resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.type("7", "8", "Escape"), "0");
  });

  test("Escape limpa a operação pendente como AC: 5, +, Escape, 3, = resulta em 3 (e não 8)", () => {
    const calc = createCalculator();
    assert.equal(calc.type("5", "+", "Escape", "3", "="), "3");
  });

  test("Backspace apaga o último dígito: 7, 8, Backspace resulta em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.type("7", "8", "Backspace"), "7");
  });

  test("teclado e botões se misturam no mesmo cálculo: 2, +, 3, Enter, mesmo resultado que 2, +, 3, =", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2"), "2");
    assert.equal(calc.type("+", "3", "Enter"), "5");
  });
});

describe("CALC-8: casos de borda do teclado físico", () => {
  test("Backspace com um único dígito volta para 0: 7, Backspace resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.type("7", "Backspace"), "0");
  });

  test("Backspace no zero não faz nada: 0, Backspace resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.type("0", "Backspace"), "0");
  });

  test("Backspace sobre ponto decimal: 7, ponto, 5, Backspace resulta em 7. e depois em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.type("7", ".", "5", "Backspace"), "7.");
    assert.equal(calc.type("Backspace"), "7");
  });

  test("Backspace com número negativo: 5, +/-, Backspace resulta em 0 (e não -)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "+/-"), "-5");
    assert.equal(calc.type("Backspace"), "0");
  });

  test("Backspace após apagar tudo e digitar de novo começa do zero: 5, Backspace, 7 resulta em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.type("5", "Backspace", "7"), "7");
  });

  test("Backspace após operador não apaga o primeiro operando: 2, +, Backspace, 3, = resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.type("2", "+", "Backspace", "3", "="), "5");
  });

  test("Backspace após igual não altera o resultado: 2, +, 3, =, Backspace resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.type("2", "+", "3", "=", "Backspace"), "5");
  });

  test("Backspace após erro mantém a mensagem de erro (CALC-65): 5, ÷, 0, =, Backspace resulta em Erro", () => {
    const calc = createCalculator();
    assert.equal(calc.type("5", "/", "0", "=", "Backspace"), "Erro");
  });

  test("Backspace após √ não altera o resultado (CALC-65): 16, √, Backspace resulta em 4, e o histórico segue com 16 √ = 4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "6", "√x", "Backspace"), "4");
    assert.deepEqual(calc.historyItems(), ["√16 = 4"]);
  });

  test("Backspace após % não altera o resultado (CALC-65): 5, 0, %, Backspace resulta em 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "0", "%", "Backspace"), "0.5");
  });

  test("Backspace após x² não altera o resultado (CALC-65): 12, x², Backspace resulta em 144", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "2", "x²", "Backspace"), "144");
  });

  test("Backspace após 1/x, log e tan também não altera o resultado (CALC-65): 4, 1/x, Backspace resulta em 0.25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("4", "1/x", "Backspace"), "0.25");
    assert.equal(calc.press("AC", "1", "0", "0", "log", "Backspace"), "2");
    assert.equal(calc.press("AC", "0", "tan", "Backspace"), "0");
  });

  test("o ⌫ apaga o dígito digitado depois de uma função e para no resultado: 16, √, 7, Backspace resulta em 4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "6", "√x", "7"), "47");
    assert.equal(calc.type("Backspace"), "4");
    assert.equal(calc.type("Backspace"), "4");
  });

  test("Backspace depois de +/- sobre resultado não vira número digitado: 16, √, +/-, Backspace resulta em -4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "6", "√x", "+/-", "Backspace"), "-4");
  });

  test(
    "resultado pequeno arredondado a 8 casas não vira notação científica: 0.00000015 seguido de % resulta em 0",
    () => {
      const calc = createCalculator();
      assert.equal(calc.press("0", ".", "0", "0", "0", "0", "0", "0", "1", "5", "%"), "0");
      assert.equal(calc.type("Backspace"), "0");
    },
  );

  test("Enter e dígitos marcam o evento como tratado (evita clique duplicado com botão focado)", () => {
    const calc = createCalculator();
    assert.equal(calc.keyDown("7").defaultPrevented, true);
    assert.equal(calc.keyDown("Enter").defaultPrevented, true);
  });

  test("teclas que a calculadora não usa são ignoradas: a, Tab e Shift não mudam o display nem são tratadas", () => {
    const calc = createCalculator();
    calc.press("4");
    for (const key of ["a", "Tab", "Shift"]) {
      assert.equal(calc.keyDown(key).defaultPrevented, false);
    }
    assert.equal(calc.type("a", "Tab", "Shift"), "4");
  });

  test(
    "atalhos com Ctrl, Cmd ou Alt são deixados para o navegador: Ctrl+7 e Ctrl+Backspace não mexem no display",
    () => {
      const calc = createCalculator();
      calc.press("4");
      const event = calc.keyDown("7", { ctrlKey: true });
      assert.equal(event.defaultPrevented, false);
      assert.equal(calc.keyDown("Backspace", { metaKey: true }).defaultPrevented, false);
      assert.equal(calc.keyDown("Escape", { altKey: true }).defaultPrevented, false);
      assert.equal(calc.type(), "4");
    },
  );
});

describe("CALC-7: critérios de aceite de erro, dígitos, arredondamento e fonte", () => {
  test("5 ÷ 0 = mostra Erro", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "="), "Erro");
  });

  test("a próxima tecla após Erro reinicia a calculadora: 5, ÷, 0, =, 7 resulta em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "=", "7"), "7");
  });

  test("operador após Erro começa do zero: 5, ÷, 0, =, −, 3, = resulta em -3", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "=", "−", "3", "="), "-3");
  });

  test("1 ÷ 3 mostra 0.33333333 (8 casas decimais)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "÷", "3", "="), "0.33333333");
  });

  test("2 ÷ 3 arredonda a 8ª casa: resulta em 0.66666667", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "÷", "3", "="), "0.66666667");
  });

  test("zeros à direita são removidos após o arredondamento: 1 ÷ 4 resulta em 0.25", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "÷", "4", "="), "0.25");
  });

  test("digitar 1234567890 mostra 123456789 (o 10º dígito é ignorado)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"), "123456789");
  });

  test("o limite de 9 dígitos vale também depois do ponto: 0.123456789 e o próximo dígito é ignorado", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", ".", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"), "0.123456789");
  });

  test("o sinal não conta no limite: 1, +/-, 2 a 9 e 0 resulta em -123456789", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "+/-", "2", "3", "4", "5", "6", "7", "8", "9", "0"), "-123456789");
  });

  test("o limite também vale para o segundo operando: 1, +, 1234567890, = resulta em 123456790", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "+", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "="), "123456790");
  });

  test("zeros à esquerda da parte inteira não contam: 0.1234567 ainda aceita mais um dígito (0.12345678)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", ".", "1", "2", "3", "4", "5", "6", "7", "8"), "0.12345678");
  });

  test("fonte de 64px com até 6 caracteres: 12345 e 12345. (6 caracteres) usam display-64", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "2", "3", "4", "5"), "12345");
    assert.equal(calc.fontSizeClass(), "display-64");
    assert.equal(calc.press("."), "12345.");
    assert.equal(calc.fontSizeClass(), "display-64");
  });

  test("o sinal conta no tamanho: -12345 (6 caracteres) usa display-64 e -123456 (7) usa display-48", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "2", "3", "4", "5", "+/-"), "-12345");
    assert.equal(calc.fontSizeClass(), "display-64");
    assert.equal(calc.press("6"), "-123456");
    assert.equal(calc.fontSizeClass(), "display-48");
  });

  test("Erro usa a fonte de 64px (5 caracteres)", () => {
    const calc = createCalculator();
    calc.press("5", "÷", "0", "=");
    assert.equal(calc.fontSizeClass(), "display-64");
  });

  test("fonte de 48px com 7 ou 8 caracteres: 1234567 e -1234567 usam display-48", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "2", "3", "4", "5", "6", "7"), "1234567");
    assert.equal(calc.fontSizeClass(), "display-48");
    assert.equal(calc.press("8"), "12345678");
    assert.equal(calc.fontSizeClass(), "display-48");
  });

  test("fonte de 40px com 9 caracteres: 123456789 usa display-40", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "2", "3", "4", "5", "6", "7", "8", "9"), "123456789");
    assert.equal(calc.fontSizeClass(), "display-40");
  });

  test("sinal e ponto contam como caracteres: -1234567 (8 caracteres) usa display-48 e 1234567. (8) também", () => {
    const calc = createCalculator();
    calc.press("1", "2", "3", "4", "5", "6", "7", "+/-");
    assert.equal(calc.fontSizeClass(), "display-48");
    const calc2 = createCalculator();
    calc2.press("1", "2", "3", "4", "5", "6", "7", ".");
    assert.equal(calc2.fontSizeClass(), "display-48");
  });

  test("a fonte volta a diminuir ao apagar: 123456789 com Backspace usa display-48", () => {
    const calc = createCalculator();
    calc.press("1", "2", "3", "4", "5", "6", "7", "8", "9");
    assert.equal(calc.type("Backspace"), "12345678");
    assert.equal(calc.fontSizeClass(), "display-48");
  });
});

describe("CALC-5: formatação de resultados", () => {
  test("0.1 + 0.2 = resulta em 0.3, sem ruído de ponto flutuante", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", ".", "1", "+", "0", ".", "2", "="), "0.3");
  });
});

// CALC-28: × e ÷ antes de + e −. Mesma precedência segue da esquerda para a direita.
describe("CALC-28: critérios de aceite da precedência de operações", () => {
  test("2 + 3 × 4 = resulta em 14", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "4", "="), "14");
  });

  test("10 − 6 ÷ 2 = resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "−", "6", "÷", "2", "="), "7");
  });
});

describe("CALC-28: casos de borda da precedência de operações", () => {
  test("× antes de + também do lado esquerdo: 2 × 3 + 4 = resulta em 10", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "×", "3", "+", "4", "="), "10");
  });

  test("× e ÷ com a mesma precedência seguem a ordem da esquerda: 10 ÷ 2 × 5 = resulta em 25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "÷", "2", "×", "5", "="), "25");
  });

  test("+ e − com a mesma precedência seguem a ordem da esquerda: 2 − 3 + 4 = resulta em 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "−", "3", "+", "4", "="), "3");
  });

  test("subtração com multiplicação: 2 − 3 × 2 = resulta em -4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "−", "3", "×", "2", "="), "-4");
  });

  test("termo em × ou ÷ com três parcelas: 2 + 3 × 4 + 1 = resulta em 15", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "4", "+", "1", "="), "15");
  });

  test("o visor mostra o parcial ao fechar um termo de mesma precedência: 2 + 3 × 4 × mostra 12", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "4", "×"), "12");
  });

  test("apertar + com um termo fechado mostra o resultado parcial: 10 − 6 ÷ 2 − mostra 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "−", "6", "÷", "2", "−"), "7");
  });

  test("× pendente não é calculado antes do segundo número: 2 + 3 × mostra 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×"), "3");
  });

  test("trocar × por + antes do segundo número refaz a conta: 2 + 3 × + 4 mostra 5 e resulta em 9", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "+"), "5");
    assert.equal(calc.press("4", "="), "9");
  });

  test("trocar + por × depois de termo já fechado reabre o termo: 1 + 2 × 3 + × mostra 6", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+", "2", "×", "3", "+", "×"), "6");
  });

  test("trocar + por × depois de termo já fechado: 1 + 2 × 3 + × 4 = resulta em 25 (1 + 2 × 3 × 4)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+", "2", "×", "3", "+", "×", "4", "="), "25");
  });

  test("trocar + por ÷ depois de termo já fechado: 1 + 2 × 3 + ÷ 4 = resulta em 2.5 (1 + 6 ÷ 4)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+", "2", "×", "3", "+", "÷", "4", "="), "2.5");
  });

  test("trocar + por − depois de termo já fechado: 1 + 2 × 3 + − 4 = resulta em 3 (1 + 6 − 4)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+", "2", "×", "3", "+", "−", "4", "="), "3");
  });

  test("trocar + por − antes do segundo número, com termo fechado: 10 − 6 + − 2 = resulta em 2 (10 − 6 − 2)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "−", "6", "+", "−", "2", "="), "2");
  });

  test("igual logo após × repete o último número: 2 + 3 × = resulta em 11 (2 + 3 × 3)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "="), "11");
  });

  test("decimais respeitam a precedência: 0.5 + 0.5 × 4 = resulta em 2.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "+", "0", ".", "5", "×", "4", "="), "2.5");
  });

  test("depois do igual, a conta seguinte começa do resultado: 2 + 3 × 4 =, + 1 = resulta em 15", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "×", "4", "=");
    assert.equal(calc.press("+", "1", "="), "15");
  });

  test("divisão por zero dentro do termo mostra Erro: 1 + 2 ÷ 0 = resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+", "2", "÷", "0", "="), "Erro");
  });

  test("divisão por zero dentro do termo também aparece ao apertar operador: 1 + 2 ÷ 0 + mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+", "2", "÷", "0", "+"), "Erro");
  });

  test("resultado do termo acima de 2^53 mostra Erro: 2 + 999999999 × 999999999 = resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(
      calc.press("2", "+", "9", "9", "9", "9", "9", "9", "9", "9", "9", "×", "9", "9", "9", "9", "9", "9", "9", "9", "9", "="),
      "Erro",
    );
  });

  test("pelo teclado, * tem precedência como ×: 2 + 3 * 4 Enter resulta em 14", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("2", "+", "3", "*", "4", "Enter"), "14");
  });

  test("histórico grava a conta na ordem digitada: 10 − 6 ÷ 2 = grava 10 − 6 ÷ 2 = 7", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "0", "−", "6", "÷", "2", "=");
    assert.deepEqual(calc.historyItems(), ["10 − 6 ÷ 2 = 7"]);
  });
});

describe("CALC-9: critérios de aceite do destaque do operador", () => {
  test("operador selecionado fica destacado até o segundo número: 2, + destaca o +, 3 remove o destaque", () => {
    const calc = createCalculator();
    calc.press("2", "+");
    assert.deepEqual(calc.selectedOperator(), ["+"]);
    calc.press("3");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("o destaque também aparece pelo teclado: 2, tecla + destaca o +", () => {
    const calc = createCalculator();
    calc.type("2", "+");
    assert.deepEqual(calc.selectedOperator(), ["+"]);
  });

  test("sem operação pendente nada fica destacado: 2, + , 3, = não destaca nenhum operador", () => {
    const calc = createCalculator();
    calc.press("2", "+", "3", "=");
    assert.deepEqual(calc.selectedOperator(), []);
  });
});

describe("CALC-9: casos de borda do destaque do operador", () => {
  test("trocar de operador antes do segundo número move o destaque: 2, +, × destaca só o ×", () => {
    const calc = createCalculator();
    calc.press("2", "+", "×");
    assert.deepEqual(calc.selectedOperator(), ["×"]);
  });

  test("= remove o destaque: 2, +, 3, = não destaca nada", () => {
    const calc = createCalculator();
    calc.press("2", "+", "3", "=");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("igual sem segundo número remove o destaque: 2, +, = resulta em 4 e não destaca nada", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "="), "4");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("AC remove o destaque: 5, +, AC não destaca nada", () => {
    const calc = createCalculator();
    calc.press("5", "+", "AC");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("ponto decimal no segundo número remove o destaque: 2, +, ponto destaca nada e mostra 0.", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "."), "0.");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("% depois do operador remove o destaque, pois o número exibido já é o segundo operando: 5, +, % não destaca nada", () => {
    const calc = createCalculator();
    calc.press("5", "+", "%");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("+/- depois do operador remove o destaque, pelo mesmo motivo: 5, +, +/- não destaca nada", () => {
    const calc = createCalculator();
    calc.press("5", "+", "+/-");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("Backspace após o operador mantém o destaque: 2, +, Backspace destaca o +", () => {
    const calc = createCalculator();
    calc.press("2", "+");
    calc.type("Backspace");
    assert.deepEqual(calc.selectedOperator(), ["+"]);
  });

  test("encadeamento mantém o destaque no novo operador: 2, +, 3, + mostra 5 e destaca o +", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "+"), "5");
    assert.deepEqual(calc.selectedOperator(), ["+"]);
  });

  test("erro não destaca operador: 5, ÷, 0, = mostra Erro sem destaque", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "="), "Erro");
    assert.deepEqual(calc.selectedOperator(), []);
  });

  test("AC, % e +/- não ganham destaque ao serem apertados", () => {
    const calc = createCalculator();
    calc.press("AC");
    assert.deepEqual(calc.selectedOperator(), []);
    calc.press("%");
    assert.deepEqual(calc.selectedOperator(), []);
    calc.press("+/-");
    assert.deepEqual(calc.selectedOperator(), []);
  });
});

describe("CALC-65: botão ⌫ na tela", () => {
  test("⌫ apaga o último dígito pelo clique: 7, 8, ⌫ resulta em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.press("7", "8", "⌫"), "7");
  });

  test("⌫ com um único dígito volta para 0: 7, ⌫ resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("7", "⌫"), "0");
  });

  test("⌫ no zero não faz nada: 0, ⌫ resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("⌫"), "0");
  });

  test("⌫ e Backspace apagam o mesmo dígito: 1, 2, 3, ⌫, Backspace resulta em 1", () => {
    const calc = createCalculator();
    assert.equal(calc.press("1", "2", "3", "⌫"), "12");
    assert.equal(calc.type("Backspace"), "1");
  });

  test("⌫ no meio de uma conta corrige o segundo número: 2, +, 3, ⌫, 4, = resulta em 6", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "⌫", "4", "="), "6");
  });

  test("⌫ depois de operador não apaga o primeiro operando: 2, +, ⌫, 3, = resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "⌫", "3", "="), "5");
  });

  test("⌫ após = não altera o resultado: 2, +, 3, =, ⌫ resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("2", "+", "3", "=", "⌫"), "5");
  });

  test("⌫ com Erro no visor mantém o Erro: 5, ÷, 0, =, ⌫ resulta em Erro", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "÷", "0", "=", "⌫"), "Erro");
  });

  test("⌫ sobre o valor de um grupo fechado não altera o valor: (2 + 3), ⌫, = resulta em 5", () => {
    const calc = createCalculator();
    assert.equal(calc.press("(", "2", "+", "3", ")", "⌫", "="), "5");
  });

  test("⌫ não grava linha no histórico: 7, 8, ⌫ deixa o histórico vazio", () => {
    const calc = createCalculator();
    calc.press("7", "8", "⌫");
    assert.deepEqual(calc.historyItems(), []);
  });
});

describe("CALC-9: critérios de aceite do efeito ao pressionar", () => {
  test("tecla física pressionada escurece o botão até soltar: 7 baixada marca o botão 7 e soltar tira a marca", () => {
    const calc = createCalculator();
    calc.keyDown("7", { code: "Digit7" });
    assert.equal(calc.buttonFor("7").classList.contains("is-pressed"), true);
    calc.keyUp("7", "Digit7");
    assert.equal(calc.buttonFor("7").classList.contains("is-pressed"), false);
  });

  test("Enter escurece o botão de igual, e soltar a tecla libera o botão", () => {
    const calc = createCalculator();
    calc.keyDown("Enter", { code: "Enter" });
    assert.equal(calc.buttonFor("=").classList.contains("is-pressed"), true);
    calc.keyUp("Enter", "Enter");
    assert.equal(calc.buttonFor("=").classList.contains("is-pressed"), false);
  });

  test("soltar com outro caractere (Shift) ainda libera o botão: = baixado com código Equal e solto como + libera o =", () => {
    const calc = createCalculator();
    calc.keyDown("=", { code: "Equal" });
    assert.equal(calc.buttonFor("=").classList.contains("is-pressed"), true);
    calc.keyUp("+", "Equal");
    assert.equal(calc.buttonFor("=").classList.contains("is-pressed"), false);
  });

  test("perder o foco da janela libera a tecla segurada: + baixado e depois blur não deixa o botão escurecido", () => {
    const calc = createCalculator();
    calc.keyDown("+", { code: "NumpadAdd" });
    assert.equal(calc.buttonFor("+").classList.contains("is-pressed"), true);
    calc.blur();
    assert.equal(calc.buttonFor("+").classList.contains("is-pressed"), false);
  });

  test("Backspace escurece o botão ⌫ até soltar (CALC-65): 7, Backspace baixado marca ⌫, soltar tira a marca e apaga o 7", () => {
    const calc = createCalculator();
    calc.press("7");
    assert.equal(calc.keyDown("Backspace", { code: "Backspace" }).key, "Backspace");
    assert.equal(calc.buttonFor("⌫").classList.contains("is-pressed"), true);
    calc.keyUp("Backspace", "Backspace");
    assert.equal(calc.buttonFor("⌫").classList.contains("is-pressed"), false);
    assert.equal(calc.type(), "0");
  });

  test("atalho com Ctrl não escurece botão: Ctrl+7 não marca o botão 7", () => {
    const calc = createCalculator();
    calc.keyDown("7", { code: "Digit7", ctrlKey: true });
    assert.equal(calc.buttonFor("7").classList.contains("is-pressed"), false);
  });
});

describe("CALC-9: estilo do feedback visual no CSS", () => {
  test("botão pressionado escurece com filtro brightness 0,8, pelo mouse ou toque (:active) e pela tecla (is-pressed)", () => {
    assert.match(CSS_SOURCE, /\.btn:active,\s*\.btn\.is-pressed\s*\{\s*filter:\s*brightness\(0\.8\);\s*\}/);
  });

  test("operador destacado tem fundo #ffffff e texto #b35c00 (contraste >= 4,5:1 sobre branco)", () => {
    assert.match(CSS_SOURCE, /\.btn-operator\[aria-pressed="true"\]\s*\{\s*background:\s*#ffffff;\s*color:\s*#b35c00;\s*\}/);
  });
});

describe("CALC-18: cores de fundo da página e da calculadora", () => {
  test("página tem fundo #686868 (cinza que a calculadora tinha) e texto #ffffff", () => {
    assert.match(CSS_SOURCE, /body\s*\{[^}]*background:\s*#686868;[^}]*color:\s*#ffffff;[^}]*\}/);
  });

  test("calculadora tem fundo #000000 (preto que a página tinha)", () => {
    assert.match(CSS_SOURCE, /\.calculator\s*\{[^}]*background:\s*#000000;[^}]*\}/);
  });
});

describe("CALC-16: critérios de aceite do limite de resultado (2^53)", () => {
  test("999999999 × 999999999 mostra Erro (e não 999999998000000000)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "×", "9", "9", "9", "9", "9", "9", "9", "9", "9", "="), "Erro");
  });

  test("99999 × 99999 = 9999800001 continua exibido sem alteração", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "9", "9", "9", "9", "×", "9", "9", "9", "9", "9", "="), "9999800001");
  });
});

describe("CALC-16: casos de borda do limite de resultado (2^53)", () => {
  test("resultado negativo acima de 2^53 em valor absoluto também mostra Erro: -999999999 × 999999999 resulta em Erro", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "+/-", "×", "9", "9", "9", "9", "9", "9", "9", "9", "9", "="), "Erro");
  });

  test("resultado exatamente abaixo do limite continua exibido: 94906265 × 94906265 = 9007199136250225 (< 2^53)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "="), "9007199136250225");
  });

  test("primeiro resultado acima do limite mostra Erro: 94906266 × 94906266 = 9007199326062756 (> 2^53)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "4", "9", "0", "6", "2", "6", "6", "×", "9", "4", "9", "0", "6", "2", "6", "6", "="), "Erro");
  });

  test("o Erro aparece já no encadeamento: 999999999 × 999999999, + mostra Erro (e não o produto)", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "×", "9", "9", "9", "9", "9", "9", "9", "9", "9", "+"), "Erro");
  });

  test("a próxima tecla após o Erro reinicia a calculadora: 999999999 × 999999999 =, 7 resulta em 7", () => {
    const calc = createCalculator();
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "×", "9", "9", "9", "9", "9", "9", "9", "9", "9", "=", "7"), "7");
  });
});

// Chave do localStorage do histórico (ver HISTORY_KEY em src/history.js).
const HISTORY_KEY = "calc-pro:historico";

describe("CALC-19: critérios de aceite do histórico de cálculos", () => {
  test("cálculo concluído com = entra no histórico: 12 × 3 = resulta em 36 e grava 12 × 3 = 36", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("1", "2", "×", "3", "="), "36");
    assert.deepEqual(calc.historyItems(), ["12 × 3 = 36"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["12 × 3 = 36"]);
  });

  test("operador sem = não grava nada: 2 + 3 não entra no histórico", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("2", "+", "3");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });

  test("itens aparecem do mais recente para o mais antigo: 2 + 3 = e depois 4 × 2 =", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.press("4", "×", "2", "=");
    assert.deepEqual(calc.historyItems(), ["4 × 2 = 8", "2 + 3 = 5"]);
  });

  test("histórico continua depois de recarregar a página: nova instância com o mesmo storage mostra o item", () => {
    const storage = {};
    createCalculator({ storage }).press("2", "+", "3", "=");
    const reloaded = createCalculator({ storage });
    assert.deepEqual(reloaded.historyItems(), ["2 + 3 = 5"]);
  });

  test("AC limpa só o visor, sem apagar o histórico: 2 + 3 =, AC mantém 2 + 3 = 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "AC"), "0");
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("Limpar histórico remove os itens da tela e do localStorage", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("2", "+", "3", "=");
    calc.clickClear();
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });

  test("Limpar histórico continua limpo depois de recarregar a página", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("2", "+", "3", "=");
    calc.clickClear();
    assert.deepEqual(createCalculator({ storage }).historyItems(), []);
  });

  test("com histórico vazio aparece a mensagem e a lista some; com item, a mensagem some e a lista aparece", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.historyEmptyHidden(), false);
    assert.equal(calc.historyListHidden(), true);
    calc.press("2", "+", "3", "=");
    assert.equal(calc.historyEmptyHidden(), true);
    assert.equal(calc.historyListHidden(), false);
  });

  test("Limpar com histórico já vazio não quebra e mantém a mensagem de vazio", () => {
    const calc = createCalculator({ storage: {} });
    calc.clickClear();
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(calc.historyEmptyHidden(), false);
  });
});

describe("CALC-19: casos de borda do histórico de cálculos", () => {
  test("igual sem segundo número grava com o próprio primeiro: 2 + = grava 2 + 2 = 4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "="), "4");
    assert.deepEqual(calc.historyItems(), ["2 + 2 = 4"]);
  });

  test("encadeamento grava a expressão inteira: 2 + 3 × 4 = grava 2 + 3 × 4 = 14", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "4", "="), "14");
    assert.deepEqual(calc.historyItems(), ["2 + 3 × 4 = 14"]);
  });

  test("trocar de operador antes do segundo número grava o operador escolhido: 2 + × 3 = grava 2 × 3 = 6", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "×", "3", "="), "6");
    assert.deepEqual(calc.historyItems(), ["2 × 3 = 6"]);
  });

  test("igual repetido não grava de novo: 2 + 3 = = grava uma única linha", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=", "=");
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("percentual como segundo operando grava o valor usado: 5 + % = grava 5 + 0.25 = 5.25 (CALC-57)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "+", "%", "="), "5.25");
    assert.deepEqual(calc.historyItems(), ["5 + 0.25 = 5.25"]);
  });

  test("conta com erro não entra no histórico: 5 ÷ 0 = mostra Erro e não grava", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "="), "Erro");
    assert.deepEqual(calc.historyItems(), []);
  });

  test("depois de erro, a expressão nova começa do zero: 5 ÷ 0 =, 7 + 2 = grava só 7 + 2 = 9", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "7", "+", "2", "="), "9");
    assert.deepEqual(calc.historyItems(), ["7 + 2 = 9"]);
  });

  test("operador logo após o igual usa o resultado como primeiro operando: 2 + 3 =, × 4 = grava 5 × 4 = 20", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=", "×", "4", "=");
    assert.deepEqual(calc.historyItems(), ["5 × 4 = 20", "2 + 3 = 5"]);
  });

  test("pelo teclado, Enter grava o cálculo: 2 + 3 Enter grava 2 + 3 = 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.type("2", "+", "3", "Enter");
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("Enter com foco no botão Limpar histórico não calcula: 2 + 3 e Enter no botão deixa 3 no visor", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: calc.historyClear });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.type(), "3");
    assert.deepEqual(calc.historyItems(), []);
  });

  test("dado corrompido no localStorage não quebra a calculadora: texto que não é JSON vira histórico vazio", () => {
    const storage = { [HISTORY_KEY]: "{não é json" };
    const calc = createCalculator({ storage });
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(calc.press("2", "+", "3", "="), "5");
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("dado salvo que não é lista é ignorado: um texto JSON comum vira histórico vazio", () => {
    const calc = createCalculator({ storage: { [HISTORY_KEY]: '"abc"' } });
    assert.deepEqual(calc.historyItems(), []);
  });

  test("entradas que não são texto são descartadas ao carregar: 7 e null saem, o texto fica", () => {
    const calc = createCalculator({ storage: { [HISTORY_KEY]: '["2 + 3 = 5", 7, null]' } });
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("ao carregar, os itens salvos também aparecem do mais recente para o mais antigo", () => {
    const calc = createCalculator({ storage: { [HISTORY_KEY]: '["2 + 3 = 5", "4 × 2 = 8"]' } });
    assert.deepEqual(calc.historyItems(), ["4 × 2 = 8", "2 + 3 = 5"]);
  });
});

describe("CALC-19: estrutura e estilo do histórico", () => {
  test("index.html tem a área do histórico, a mensagem de vazio e o botão Limpar histórico", () => {
    assert.match(HTML_SOURCE, /class="history"/);
    assert.match(HTML_SOURCE, /id="history-list"/);
    assert.match(HTML_SOURCE, /Ainda não há cálculos\./);
    assert.match(HTML_SOURCE, /id="history-clear"[^>]*>Limpar histórico<\/button>/);
  });

  test("o histórico fica escondido no mobile e aparece a partir de 768px, no mesmo corte do projeto", () => {
    const base = CSS_BASE;
    const desktop = CSS_DESKTOP;
    assert.match(base, /\.history\s*\{\s*display:\s*none;\s*\}/);
    assert.match(desktop, /\.history\s*\{[^}]*display:\s*flex;/);
  });

  test("lista vazia (hidden) fica fora da renderização: a regra [hidden] vence o display flex da lista", () => {
    assert.match(CSS_SOURCE, /\.history-list\s*\{[^}]*display:\s*flex;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.history-list\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
    // Especificidade: .history-list[hidden] (0,2,0) vence .history-list (0,1,0); a ordem abaixo mantém a regra junto dela no arquivo.
    assert.ok(CSS_SOURCE.indexOf(".history-list[hidden]") > CSS_SOURCE.indexOf(".history-list {"));
  });

  test("histórico usa o fundo escuro e o cinza do texto de apoio", () => {
    assert.match(CSS_SOURCE, /\.history-item\s*\{[^}]*background:\s*#333333;[^}]*color:\s*#ffffff;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.history-empty\s*\{[^}]*color:\s*#a5a5a5;[^}]*\}/);
  });
});

describe("CALC-20: critérios de aceite do histórico reformulado", () => {
  test("cada cálculo vira um item próprio, com a expressão e o resultado em elementos separados: 12 × 3 = resulta em 36", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "2", "×", "3", "=");
    assert.deepEqual(calc.historyItemParts(0), {
      expression: "12 × 3",
      result: "36",
      label: "12 × 3 igual a 36, usar no visor",
    });
  });

  test("tocar num item leva o resultado para o visor: 2 + 3 =, tocar no item mostra 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    assert.equal(calc.tapHistoryItem(0), "5");
  });

  test("dá para continuar a conta a partir do resultado tocado: 2 + 3 =, tocar, + 1 = resulta em 6", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.tapHistoryItem(0);
    assert.equal(calc.press("+", "1", "="), "6");
  });

  test("tocar no item e digitar começa um número novo: 2 + 3 =, tocar, 7 resulta em 7 (e não 57)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.tapHistoryItem(0);
    assert.equal(calc.press("7"), "7");
  });

  test("tocar num item não apaga o histórico: 2 + 3 =, tocar mantém 2 + 3 = 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.tapHistoryItem(0);
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("Enter com o foco num item do histórico não faz conta: o item é um botão e o Enter o aciona", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    const event = calc.keyDown("Enter", { target: calc.historyItemButton(0) });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "5");
  });

  test("sem cálculos o botão Limpar fica escondido; com cálculo ele aparece", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.historyActionsHidden(), true);
    calc.press("2", "+", "3", "=");
    assert.equal(calc.historyActionsHidden(), false);
    assert.equal(calc.clearButtonHidden(), false);
  });

  test("Limpar abre a confirmação e não apaga ainda: 2 + 3 =, Limpar mantém o item e mostra a confirmação", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("2", "+", "3", "=");
    calc.clickClearButton();
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
    assert.equal(HISTORY_KEY in storage, true);
    assert.equal(calc.confirmHidden(), false);
    assert.equal(calc.clearButtonHidden(), true);
  });

  test("a confirmação começa com o foco em Cancelar, a ação segura", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.clickClearButton();
    assert.equal(calc.cancelFocused(), true);
  });

  test("Cancelar mantém o histórico e volta o botão Limpar: 2 + 3 =, Limpar, Cancelar mantém 2 + 3 = 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.clickClearButton();
    calc.clickCancel();
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
    assert.equal(calc.confirmHidden(), true);
    assert.equal(calc.clearButtonHidden(), false);
  });

  test("Apagar na confirmação limpa o histórico e leva o foco à mensagem de vazio", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("2", "+", "3", "=");
    calc.clickClear();
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
    assert.equal(calc.historyActionsHidden(), true);
    assert.equal(calc.emptyMessageFocused(), true);
  });

  test("depois de Apagar a confirmação some, e o botão Limpar continua escondido porque o histórico ficou vazio", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.clickClear();
    assert.equal(calc.confirmHidden(), true);
    assert.equal(calc.historyActionsHidden(), true);
  });
});

describe("CALC-20: casos de borda do histórico reformulado", () => {
  test("o botão Limpar não aparece quando o histórico é carregado vazio, mesmo com dado corrompido", () => {
    const calc = createCalculator({ storage: { [HISTORY_KEY]: "{não é json" } });
    assert.equal(calc.historyActionsHidden(), true);
  });

  test("itens sem o separador ' = ' não entram no histórico ao carregar: texto solto é descartado e não vira resultado vazio", () => {
    const calc = createCalculator({ storage: { [HISTORY_KEY]: '["2 + 3 = 5", "texto solto"]' } });
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("resultado com sinal negativo vai para o visor: 2 − 7 = mostra -5 e tocar no item também mostra -5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "−", "7", "="), "-5");
    calc.press("AC");
    assert.equal(calc.tapHistoryItem(0), "-5");
  });

  test("com vários cálculos, o toque no mais antigo leva o resultado dele: 2 + 3 = e 4 × 2 =, tocar no item 2 mostra 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.press("4", "×", "2", "=");
    assert.equal(calc.tapHistoryItem(1), "5");
  });
});

describe("CALC-20: estilo e estrutura do histórico reformulado", () => {
  test("index.html tem o botão Limpar dentro do painel de ações, a confirmação e a lista com foco por teclado", () => {
    assert.match(HTML_SOURCE, /id="history-actions"/);
    assert.match(HTML_SOURCE, /id="history-confirm"/);
    assert.match(HTML_SOURCE, /id="history-cancel"[^>]*>Cancelar<\/button>/);
    assert.match(HTML_SOURCE, /id="history-confirm-yes"[^>]*>Apagar<\/button>/);
    assert.match(HTML_SOURCE, /id="history-list"[^>]*tabindex="0"/);
  });

  test("no desktop o painel tem a mesma largura da calculadora (360px) e fica alinhado ao topo dela", () => {
    const desktop = CSS_DESKTOP;
    assert.match(desktop, /\.calculator\s*\{[^}]*width:\s*360px;[^}]*\}/);
    assert.match(desktop, /\.history\s*\{[^}]*width:\s*min\(360px,\s*100%\);[^}]*\}/);
    assert.match(desktop, /\.layout\s*\{[^}]*align-items:\s*start;[^}]*\}/);
  });

  test("a lista rola dentro do painel com altura máxima, sem empurrar o layout", () => {
    assert.match(CSS_SOURCE, /\.history-list\s*\{[^}]*max-height:\s*26rem;[^}]*overflow-y:\s*auto;[^}]*\}/);
  });

  test("o resultado tem mais destaque que a expressão: fonte maior e mais grossa", () => {
    const fontSizeRem = (selector) => {
      const match = CSS_SOURCE.match(new RegExp(`${selector}\\s*\\{[^}]*font-size:\\s*([\\d.]+)rem;`));
      assert.ok(match, `${selector} precisa de font-size em rem`);
      return Number(match[1]);
    };
    assert.ok(fontSizeRem("\\.history-result") > fontSizeRem("\\.history-expression"));
    assert.match(CSS_SOURCE, /\.history-result\s*\{[^}]*font-weight:\s*600;[^}]*\}/);
  });

  test("o botão Limpar tem visual secundário: fundo transparente, contorno e texto cinza, sem o laranja dos operadores", () => {
    assert.match(CSS_SOURCE, /\.history-clear,\s*\.history-cancel\s*\{[^}]*background:\s*transparent;[^}]*color:\s*#a5a5a5;[^}]*\}/);
    assert.doesNotMatch(CSS_SOURCE, /\.history-clear\s*\{[^}]*#ff9f0a/);
  });

  test("a regra [hidden] vence o display flex do painel de ações e da confirmação", () => {
    assert.match(CSS_SOURCE, /\.history-actions\[hidden\],\s*\.history-confirm\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  });
});

// Regras do mobile: o bloco @media (max-width: 767px) fica no fim de cada arquivo de css/, somados aqui.
const MOBILE_CSS = CSS_FILES.map((css) => (css.match(/@media \(max-width: 767px\) \{[\s\S]*$/) || [""])[0]).join("\n");

// Lado do botão no mobile, como o tema.css calcula em --cell: o menor entre a largura (7 colunas, com 6 espaços)
// e a altura (5 linhas, com o visor com pelo menos --display-min e a linha de status). Em px, com 1rem = 16px:
// --pad 14, --gap 4, --display-min 72, --status-height 24.
function mobileButtonSide(width, height) {
  const pad = 14;
  const gap = 4;
  const displayMin = 72;
  const statusHeight = 24;
  const byWidth = (width - 2 * pad - 6 * gap) / 7;
  const byHeight = (height - 2 * pad - 4 * gap - displayMin - statusHeight) / 5;
  return Math.min(byWidth, byHeight);
}

describe("CALC-21: critérios de aceite do layout mobile", () => {
  test("no mobile a calculadora ocupa a viewport inteira: fundo preto na página, 100% de largura e altura, sem cantos", () => {
    assert.ok(MOBILE_CSS.length > 0, "precisa existir um bloco @media (max-width: 767px)");
    assert.match(MOBILE_CSS, /body\s*\{[^}]*background:\s*#000000;[^}]*\}/);
    assert.match(MOBILE_CSS, /\.layout\s*\{[^}]*height:\s*100dvh;[^}]*\}/);
    assert.match(MOBILE_CSS, /\.calculator\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*border-radius:\s*0;[^}]*\}/);
  });

  test("botões são quadrados do mesmo lado (--cell), a grade científica e o teclado usam o mesmo lado, e o 0 ocupa duas colunas", () => {
    assert.match(MOBILE_CSS, /\.calculator\s*\{[^}]*--cell:\s*min\(/);
    assert.match(CSS_SOURCE, /\.keypad\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*var\(--cell\)\);[^}]*\}/);
    assert.match(CSS_SOURCE, /\.keypad\s*\{[^}]*grid-auto-rows:\s*var\(--cell\);[^}]*\}/);
    assert.match(CSS_SOURCE, /\.scientific\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*var\(--cell\)\);[^}]*\}/);
    assert.match(CSS_SOURCE, /\.scientific\s*\{[^}]*grid-auto-rows:\s*var\(--cell\);[^}]*\}/);
    assert.match(CSS_SOURCE, /\.btn-zero\s*\{[^}]*grid-column:\s*span 2;[^}]*\}/);
  });

  test("em 360x640, 390x844, 414x896 e na paisagem 844x390, o teclado cabe na tela e os botões têm pelo menos 44px", () => {
    for (const [width, height] of [
      [360, 640],
      [390, 844],
      [414, 896],
      [844, 390],
    ]) {
      const side = mobileButtonSide(width, height);
      const keypadHeight = 5 * side + 4 * 4;
      assert.ok(side >= 44, `${width}x${height}: botão de ${side}px`);
      // Padding 14 nos dois lados, linha de status 24, visor mínimo 72 e o teclado (5 linhas).
      assert.ok(2 * 14 + 24 + 72 + keypadHeight <= height, `${width}x${height}: teclado não cabe na altura`);
    }
  });

  test("o botão Histórico aparece só no mobile: escondido na base e visível no bloco mobile", () => {
    assert.match(CSS_SOURCE, /\.history-open,\s*\.history-close\s*\{\s*display:\s*none;\s*\}/);
    assert.match(MOBILE_CSS, /\.history-open\s*\{[^}]*display:\s*inline-flex;[^}]*\}/);
  });

  test("index.html tem o botão Histórico ligado ao painel e o × com rótulo para leitor de tela", () => {
    assert.match(
      HTML_SOURCE,
      /id="history-open"[^>]*aria-controls="history-panel"[^>]*aria-expanded="false"[^>]*>Histórico<\/button>/,
    );
    assert.match(HTML_SOURCE, /<section class="history" id="history-panel"/);
    assert.match(HTML_SOURCE, /id="history-close"[^>]*aria-label="Fechar histórico"[^>]*>×<\/button>/);
  });
});

describe("CALC-21: critérios de aceite do histórico em tela cheia no mobile", () => {
  test("o botão Histórico abre o painel e marca aria-expanded: antes de abrir o painel está fechado", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.panelShown(), false);
    calc.tapHistoryOpen();
    assert.equal(calc.panelShown(), true);
    assert.equal(calc.openButtonExpanded(), "true");
  });

  test("o painel mostra os cálculos feitos: 2 + 3 =, abrir mostra o item 2 + 3 = 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.tapHistoryOpen();
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5"]);
  });

  test("o × fecha o painel e devolve o foco ao botão Histórico; abrir já deixa o foco no ×", () => {
    const calc = createCalculator({ storage: {} });
    calc.tapHistoryOpen();
    assert.equal(calc.closeButtonFocused(), true);
    calc.tapHistoryClose();
    assert.equal(calc.panelShown(), false);
    assert.equal(calc.openButtonExpanded(), "false");
    assert.equal(calc.openButtonFocused(), true);
  });

  test("com o painel aberto a calculadora fica inerte, e volta a funcionar ao fechar", () => {
    const calc = createCalculator({ storage: {} });
    calc.tapHistoryOpen();
    assert.equal(calc.calculatorInert(), true);
    calc.tapHistoryClose();
    assert.equal(calc.calculatorInert(), false);
  });

  test("com o painel aberto, as teclas não mexem no visor; Escape fecha o painel sem limpar o visor", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5");
    calc.tapHistoryOpen();
    assert.equal(calc.type("7", "+"), "5");
    assert.equal(calc.panelShown(), true);
    calc.type("Escape");
    assert.equal(calc.panelShown(), false);
    assert.equal(calc.display(), "5");
  });

  test("tocar num item do histórico no mobile leva o resultado ao visor e fecha o painel", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    calc.tapHistoryOpen();
    assert.equal(calc.tapHistoryItem(0), "5");
    assert.equal(calc.panelShown(), false);
  });
});

describe("CALC-22: critérios de aceite do M+ e do indicador de memória", () => {
  test("display 5, M+, AC, display 3, M+ deixa a memória em 8", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "3", "M+"), "3");
    assert.equal(calc.memoryValue(), 8);
  });

  test("o indicador de memória aparece com valor guardado e some quando a memória volta a 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.memoryIndicatorHidden(), true);
    calc.press("5", "M+");
    assert.equal(calc.memoryIndicatorHidden(), false);
    calc.press("AC", "5", "+/-", "M+");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("pelo teclado, m e M somam ao registrador: 5, m, 3, M resulta em memória 8 e visor 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("5", "m", "Escape", "3", "M"), "3");
    assert.equal(calc.memoryValue(), 8);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("clique e teclado se misturam: 5, M+ (botão), Escape, 3, m (tecla) deixa a memória em 8", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+");
    calc.type("Escape", "3", "m");
    assert.equal(calc.memoryValue(), 8);
  });

  test("M+ não entra no histórico de cálculos: 5, M+ não grava nada", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });
});

describe("CALC-22: casos de borda do M+ e do indicador de memória", () => {
  test("M+ com zero no visor não guarda nada: AC, M+ mantém a memória em 0 e o indicador escondido", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("AC", "M+"), "0");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("AC não apaga a memória: 5, M+, AC mantém a memória em 5 e o indicador visível", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC"), "0");
    assert.equal(calc.memoryValue(), 5);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("M+ não muda o visor nem o operador pendente: 2, +, 3, M+, = resulta em 5 e a memória fica em 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "M+", "="), "5");
    assert.equal(calc.memoryValue(), 3);
  });

  test("com Erro no visor, M+ não faz nada: 5, ÷, 0, =, M+ mantém o Erro e a memória em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "M+"), "Erro");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("decimais somam sem ruído de ponto flutuante: 0.1, M+, AC, 0.2, M+ deixa a memória em 0.3", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("0", ".", "1", "M+", "AC", "0", ".", "2", "M+");
    assert.equal(calc.memoryValue(), 0.3);
  });

  test("valor negativo subtrai da memória: 5, M+, AC, 8, +/-, M+ deixa a memória em -3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "8", "+/-", "M+"), "-8");
    assert.equal(calc.memoryValue(), -3);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("soma acima de 2^53 mostra Erro e a memória fica como estava: 94906265 × 94906265 =, M+, M+", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "=", "M+");
    assert.equal(calc.memoryValue(), 9007199136250225);
    assert.equal(calc.press("M+"), "Erro");
    assert.equal(calc.memoryValue(), 9007199136250225);
  });

  test("a próxima tecla depois do Erro de memória reinicia a calculadora: 7 resulta em 7 e a memória continua", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "=", "M+", "M+");
    assert.equal(calc.press("7"), "7");
    assert.equal(calc.memoryValue(), 9007199136250225);
  });
});

describe("CALC-22: teclado e foco do M+", () => {
  test("a tecla m deixa o botão M+ destacado até soltar a tecla", () => {
    const calc = createCalculator({ storage: {} });
    calc.keyDown("m", { code: "KeyM" });
    assert.equal(calc.buttonFor("M+").classList.contains("is-pressed"), true);
    calc.keyUp("m", "KeyM");
    assert.equal(calc.buttonFor("M+").classList.contains("is-pressed"), false);
  });

  test("Enter com o foco no M+ não vira igual: o botão é que age (clique nativo), o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });
});

describe("CALC-22: estrutura e estilo do M+ e do indicador", () => {
  test("index.html tem o botão M+ com rótulo que contém M+, fora do teclado, e o indicador começa escondido", () => {
    assert.match(
      HTML_SOURCE,
      /<button type="button" id="memory-add" class="memory-add" data-action="memory-add" aria-label="Somar à memória \(M\+\)">M\+<\/button>/,
    );
    assert.match(HTML_SOURCE, /<span id="memory-indicator" class="memory-indicator" hidden>/);
    assert.match(HTML_SOURCE, /class="sr-only">Memória com valor guardado</);
  });

  test("o indicador não define display, para o atributo hidden continuar valendo", () => {
    assert.doesNotMatch(CSS_SOURCE, /\.memory-indicator\s*\{[^}]*display:/);
    assert.match(CSS_SOURCE, /\.memory-indicator\s*\{[^}]*color:\s*#ff9f0a;[^}]*\}/);
  });

  test("o M+ tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });

  test("no mobile a grade científica e o teclado não encolhem com o visor: .panel com flex: none", () => {
    assert.match(MOBILE_CSS, /\.panel\s*\{\s*flex:\s*none;/);
  });
});

describe("CALC-66: critérios de aceite do indicador M no display", () => {
  test("M aparece após M+ e após M- com valor diferente de zero, e some após MC: 5, M+, 8, M- mostra o M com memória -3; MC esconde", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC");
    assert.equal(calc.memoryIndicatorHidden(), false);
    calc.press("AC", "8", "M-");
    assert.equal(calc.memoryValue(), -3);
    assert.equal(calc.memoryIndicatorHidden(), false);
    calc.press("MC");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("M- com resultado zero não acende o M: 5, M+, AC, 5, M- deixa o indicador escondido", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC", "5", "M-");
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("o M é texto visível no indicador, e o leitor de tela ouve 'Memória com valor guardado' em vez de 'M' sozinho", () => {
    assert.match(
      HTML_SOURCE,
      /<span id="memory-indicator" class="memory-indicator" hidden><span aria-hidden="true">M<\/span><span class="sr-only">Memória com valor guardado<\/span><\/span>/,
    );
  });

  test("o indicador fica na linha de status acima do visor, antes do display no HTML", () => {
    assert.ok(HTML_SOURCE.indexOf('id="memory-indicator"') < HTML_SOURCE.indexOf('id="display"'));
    assert.ok(HTML_SOURCE.indexOf('class="status"') < HTML_SOURCE.indexOf('id="memory-indicator"'));
  });

  test("no desktop o indicador aparece: .status é flex na base e nenhuma regra do desktop esconde .status ou .memory-indicator", () => {
    assert.match(CSS_BASE, /\.status\s*\{[^}]*display:\s*flex;[^}]*\}/);
    assert.doesNotMatch(CSS_DESKTOP, /\.(status|memory-indicator)\s*\{[^}]*display:\s*none/);
  });

  test("no mobile o indicador aparece: a linha de status não encolhe (flex: none) e nenhuma regra do mobile esconde .status ou .memory-indicator", () => {
    assert.match(MOBILE_CSS, /\.status\s*\{\s*flex:\s*none;\s*min-height:\s*var\(--status-height\);\s*\}/);
    assert.doesNotMatch(MOBILE_CSS, /\.(status|memory-indicator)\s*\{[^}]*display:\s*none/);
  });
});

describe("CALC-26: critérios de aceite do x² (quadrado)", () => {
  test("9 x² mostra 81", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "x²"), "81");
  });

  test("resultado respeita a formatação do visor: 1.1 x² mostra 1.21 (sem ruído de ponto flutuante)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", ".", "1", "x²"), "1.21");
  });
});

describe("CALC-26: casos de borda do x² (quadrado)", () => {
  test("zero continua zero: 0 x² mostra 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "x²"), "0");
  });

  test("negativo é elevado normalmente: 3, +/-, x² mostra 9", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "+/-", "x²"), "9");
  });

  test("decimal menor que 1 diminui: 0.5 x² mostra 0.25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "x²"), "0.25");
  });

  test("quadrado pequeno é arredondado a 8 casas: 0.0001 x² mostra 0.00000001 (sem notação científica)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "0", "0", "0", "1", "x²"), "0.00000001");
  });

  test("quadrado abaixo de 8 casas vira 0: 0.00001 x² mostra 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "0", "0", "0", "0", "1", "x²"), "0");
  });

  test("resultado exatamente abaixo do limite de 2^53 continua exibido: 94906265 x² mostra 9007199136250225", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "4", "9", "0", "6", "2", "6", "5", "x²"), "9007199136250225");
  });

  test("resultado acima do limite de 2^53 mostra Erro: 94906266 x² mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "4", "9", "0", "6", "2", "6", "6", "x²"), "Erro");
  });

  test("9 dígitos ao quadrado estouram o limite: 999999999 x² mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "x²"), "Erro");
  });

  test("com Erro no visor, x² mantém o Erro: 5 ÷ 0 =, x² mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "x²"), "Erro");
  });

  test("a próxima tecla depois do Erro do x² reinicia a calculadora: 999999999 x², 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "x²", "7"), "7");
  });

  test("x² depois do igual eleva o resultado: 2 + 3 =, x² mostra 25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "x²"), "25");
  });

  test("x² no segundo operando entra na conta: 2 + 3 x², = resulta em 11", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "x²", "="), "11");
  });

  test("x² depois do operador vira o segundo operando, como o %: 2 + x², = resulta em 6", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "x²", "="), "6");
  });

  test("x² grava a própria linha no histórico (CALC-43): 9 x² grava 9² = 81", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("9", "x²");
    assert.deepEqual(calc.historyItems(), ["9² = 81"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["9² = 81"]);
  });

  test("o cálculo usa o valor elevado no histórico: 2 + 3 x², = grava 2 + 9 = 11 e antes 3² = 9", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "x²", "=");
    assert.deepEqual(calc.historyItems(), ["2 + 9 = 11", "3² = 9"]);
  });

  test("x² não mexe na memória: 5 M+, 3 x² mantém a memória em 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC", "3", "x²");
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-26: teclado, foco e estrutura do x²", () => {
  test("Enter com o foco no x² não vira igual: o botão é que age (clique nativo), o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão x² na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="square-button" class="square-add" data-action="square" aria-label="Elevar ao quadrado \(x²\)">x²<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o x² tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-34: critérios de aceite do log (logaritmo decimal)", () => {
  test("log(1000) = 3: 1000, log resulta em 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "0", "0", "log"), "3");
  });

  test("log(0) mostra Erro: 0, log resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "log"), "Erro");
  });

  test("log(-1) mostra Erro: 1, +/-, log resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+/-", "log"), "Erro");
  });
});

describe("CALC-34: casos de borda do log (logaritmo decimal)", () => {
  test("log(1) = 0: 1, log resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "log"), "0");
  });

  test("log(10) = 1: 1, 0, log resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "log"), "1");
  });

  test("valor entre 0 e 1 tem log negativo: 0,1 log resulta em -1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "1", "log"), "-1");
  });

  test("resultado não exato segue a precisão do visor: 2 log resulta em 0.30103 (8 casas, zeros à direita removidos)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "log"), "0.30103");
  });

  test("resultado negativo não exato também é arredondado: 0,5 log resulta em -0.30103", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "log"), "-0.30103");
  });

  test("log muito próximo de 0 não mostra -0 nem notação científica: 1,00000001 log resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", ".", "0", "0", "0", "0", "0", "0", "0", "1", "log"), "0");
  });

  test("valor muito pequeno sem notação científica: 0,00000001 log resulta em -8", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "0", "0", "0", "0", "0", "0", "0", "1", "log"), "-8");
  });

  test("Erro reinicia com o próximo dígito: 0, log, 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "log", "7"), "7");
  });

  test("log com Erro no visor mantém o Erro: 0, log, log resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "log", "log"), "Erro");
  });

  test("log depois do igual usa o resultado: 2 + 3 =, log resulta em 0.69897", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "log"), "0.69897");
  });

  test("log no segundo operando entra na conta, como o x²: 2 + log =, resulta em 2.30103", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "log", "="), "2.30103");
  });
});

describe("CALC-34: histórico, teclado, foco e estrutura do log", () => {
  test("log grava a própria linha no histórico (CALC-43): 1000 log grava log(1000) = 3", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("1", "0", "0", "0", "log");
    assert.deepEqual(calc.historyItems(), ["log(1000) = 3"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["log(1000) = 3"]);
  });

  test("Enter com o foco no log não vira igual: o botão é que age (clique nativo), o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão log na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="log-button" class="log-button" data-action="log" aria-label="Logaritmo na base 10 \(log\)">log<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o log tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-31: critérios de aceite do seno (sen, em graus)", () => {
  test("sen(30°) = 0.5: 3, 0, sen resulta em 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "0", "sen"), "0.5");
  });

  test("a unidade angular fica visível o tempo todo: DEG aparece no HTML, no botão, sem o atributo hidden", () => {
    assert.match(
      HTML_SOURCE,
      /<button type="button" id="angle-unit" class="angle-unit" data-action="angle-unit" aria-label="DEG \(graus\), trocar para radianos">DEG<\/button>/,
    );
    assert.doesNotMatch(HTML_SOURCE, /id="angle-unit"[^>]*hidden/);
    assert.doesNotMatch(CSS_SOURCE, /\.angle-unit\s*\{[^}]*display:\s*none;[^}]*\}/);
  });
});

describe("CALC-31: casos de borda do seno", () => {
  test("valores de referência em graus: sen 0° = 0, sen 90° = 1, sen 180° = 0, sen 270° = -1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "sen"), "0");
    assert.equal(calc.press("AC", "9", "0", "sen"), "1");
    assert.equal(calc.press("AC", "1", "8", "0", "sen"), "0");
    assert.equal(calc.press("AC", "2", "7", "0", "sen"), "-1");
  });

  test("180° não mostra -0: sen 180 resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "8", "0", "sen"), "0");
  });

  test("ângulo negativo: sen(-30°) = -0.5, com +/- antes do sen", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "0", "+/-", "sen"), "-0.5");
  });

  test("ângulos fora de 0 a 360 são reduzidos: sen 390 = 0.5 e sen 360 = 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "9", "0", "sen"), "0.5");
    assert.equal(calc.press("AC", "3", "6", "0", "sen"), "0");
  });

  test("ângulo grande com precisão: sen 999999999° = -0.98768834 (módulo 360 antes do seno)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "sen"), "-0.98768834");
  });

  test("resultado com casas decimais segue o arredondamento de 8 casas: sen 60° = 0.8660254 e sen 1° = 0.01745241", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("6", "0", "sen"), "0.8660254");
    assert.equal(calc.press("AC", "1", "sen"), "0.01745241");
  });

  test("seno menor que 5e-9 some no arredondamento, sem notação científica: 0.00000001 sen mostra 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "0", "0", "0", "0", "0", "0", "0", "1", "sen"), "0");
  });

  test("com Erro no visor, sen mantém o Erro: 5 ÷ 0 =, sen mostra Erro, e a próxima tecla reinicia", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "sen"), "Erro");
    assert.equal(calc.press("7"), "7");
  });

  test("sen depois do igual calcula o resultado: 2 + 3 =, sen mostra 0.08715574", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "sen"), "0.08715574");
  });

  test("sen depois do operador vira o segundo operando, como o % e o x²: 2 + 3 0 sen =, resulta em 2.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "0", "sen", "="), "2.5");
    assert.deepEqual(calc.historyItems(), ["2 + 0.5 = 2.5", "sen(30) = 0.5"]);
  });

  test("sen grava a própria linha no histórico e não mexe na memória (CALC-43): 5 M+, AC, 3 0 sen grava sen(30) = 0.5 e mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "3", "0", "sen");
    assert.deepEqual(calc.historyItems(), ["sen(30) = 0.5"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["sen(30) = 0.5"]);
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-31: teclado, foco e estrutura do sen", () => {
  test("sen não tem tecla própria: Enter com o foco no botão sen não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão sen na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="sine-button" class="sine-add" data-action="sine" aria-label="Seno \(sen\)">sen<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o sen tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

// CALC-41: alternância DEG/RAD da unidade angular do sen. Padrão é graus; trocar não recalcula o visor.
describe("CALC-41: critérios de aceite da unidade angular (DEG/RAD)", () => {
  test("alternar para rad muda sen(π/2) para 1: unidade, π, ÷, 2, =, sen resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("unidade", "π", "÷", "2", "=");
    assert.equal(calc.press("sen"), "1");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });

  test("voltar para graus muda sen(90) para 1: unidade, unidade, 9, 0, sen resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "unidade", "9", "0", "sen"), "1");
    assert.equal(calc.angleUnitLabel(), "DEG");
  });

  test("a unidade aparece no visor o tempo todo: começa em DEG e troca para RAD sem esconder o rótulo", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.angleUnitLabel(), "DEG");
    calc.press("unidade");
    assert.equal(calc.angleUnitLabel(), "RAD");
    calc.press("5", "+", "3", "=");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });
});

describe("CALC-41: casos de borda da unidade angular", () => {
  test("padrão é graus: sen 90 resulta em 1 sem tocar na unidade, e o botão diz DEG (graus)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "0", "sen"), "1");
    assert.equal(calc.angleUnitName(), "DEG (graus), trocar para radianos");
  });

  test("rótulo acessível acompanha a unidade: RAD (radianos) com a troca de volta para graus", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("unidade");
    assert.equal(calc.angleUnitName(), "RAD (radianos), trocar para graus");
  });

  test("em rad, sen 90 é o seno de 90 radianos: unidade, 9, 0, sen resulta em 0.89399666", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "9", "0", "sen"), "0.89399666");
  });

  test("em rad, sen 0 é 0: unidade, 0, sen resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "0", "sen"), "0");
  });

  test("em rad, π vale 3.14159265 (8 casas), e sen π resulta em 0: unidade, π, sen resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "π", "sen"), "0");
  });

  test("a unidade vale no momento do sen: 9, 0, unidade, sen usa radianos e resulta em 0.89399666", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "0", "unidade", "sen"), "0.89399666");
  });

  test("trocar a unidade não recalcula o visor: 2 + 3 =, unidade mostra 5 e RAD", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "="), "5");
    assert.equal(calc.press("unidade"), "5");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });

  test("trocar a unidade não mexe na conta pendente: 2, +, 3, unidade, = resulta em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "unidade", "="), "5");
  });

  test("trocar a unidade não mexe no histórico nem na memória: 5 M+, unidade, unidade mantém 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "unidade", "unidade");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-41: cos segue a unidade angular", () => {
  test("cos em radianos: unidade, 1, cos resulta em 0.54030231 (cos 1 rad), e a unidade continua RAD", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "1", "cos"), "0.54030231");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });

  test("cos em radianos de 0 e de π: unidade, 0, cos resulta em 1; unidade, π, cos resulta em -1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "0", "cos"), "1");
    assert.equal(calc.press("AC", "π", "cos"), "-1");
  });

  test("cos em graus continua em graus com a unidade DEG: 6 0 cos resulta em 0.5, e 9 0 cos resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("6", "0", "cos"), "0.5");
    assert.equal(calc.press("AC", "9", "0", "cos"), "0");
  });

  test("com Erro no visor, cos mantém o Erro mesmo em rad: 5 ÷ 0 =, unidade, cos mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "unidade", "cos"), "Erro");
  });
});

describe("CALC-32: critérios de aceite do cos (cos, em graus)", () => {
  test("cos(60°) = 0.5: 6, 0, cos resulta em 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("6", "0", "cos"), "0.5");
  });

  test("cos(0) = 1: 0, cos resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "cos"), "1");
  });

  test("sem ruído de ponto flutuante: cos 90° mostra 0, não 6.12e-17", () => {
    const calc = createCalculator({ storage: {} });
    const shown = calc.press("9", "0", "cos");
    assert.equal(shown, "0");
    assert.doesNotMatch(shown, /e/);
  });
});

describe("CALC-32: casos de borda do cos", () => {
  test("valores de referência em graus: cos 0° = 1, cos 90° = 0, cos 180° = -1, cos 270° = 0, cos 360° = 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "cos"), "1");
    assert.equal(calc.press("AC", "9", "0", "cos"), "0");
    assert.equal(calc.press("AC", "1", "8", "0", "cos"), "-1");
    assert.equal(calc.press("AC", "2", "7", "0", "cos"), "0");
    assert.equal(calc.press("AC", "3", "6", "0", "cos"), "1");
  });

  test("270° não mostra ruído: cos 270 resulta em 0 (Math.cos daria -1.8e-16)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "7", "0", "cos"), "0");
  });

  test("ângulo negativo: cos(-60°) = 0.5, com +/- antes do cos", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("6", "0", "+/-", "cos"), "0.5");
  });

  test("ângulos fora de 0 a 360 são reduzidos: cos 390 = 0.8660254 (cos 30°)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "9", "0", "cos"), "0.8660254");
  });

  test("resultado com casas decimais segue o arredondamento de 8 casas: cos 1° = 0.9998477", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "cos"), "0.9998477");
  });

  test("cosseno dentro de 5e-9 de 1 some no arredondamento, sem notação científica: 0.00000001 cos mostra 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "0", "0", "0", "0", "0", "0", "0", "1", "cos"), "1");
  });

  test("com Erro no visor, cos mantém o Erro: 5 ÷ 0 =, cos mostra Erro, e a próxima tecla reinicia", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "cos"), "Erro");
    assert.equal(calc.press("7"), "7");
  });

  test("cos depois do igual calcula o resultado: 2 + 58 =, cos mostra 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "5", "8", "=", "cos"), "0.5");
    assert.deepEqual(calc.historyItems(), ["cos(60) = 0.5", "2 + 58 = 60"]);
  });

  test("cos depois do operador vira o segundo operando, como o sen: 2 + 6 0 cos =, resulta em 2.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "6", "0", "cos", "="), "2.5");
    assert.deepEqual(calc.historyItems(), ["2 + 0.5 = 2.5", "cos(60) = 0.5"]);
  });

  test("cos grava a própria linha no histórico e não mexe na memória (CALC-43): 5 M+, AC, 6 0 cos grava cos(60) = 0.5 e mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "6", "0", "cos");
    assert.deepEqual(calc.historyItems(), ["cos(60) = 0.5"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["cos(60) = 0.5"]);
    assert.equal(calc.memoryValue(), 5);
  });

  test("com Erro no visor, a unidade troca e o Erro continua: 5 ÷ 0 =, unidade mostra Erro e RAD", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "unidade"), "Erro");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });

});

describe("CALC-41: estrutura e foco do botão DEG/RAD", () => {
  test("o botão DEG/RAD fica na linha de status, acima do visor (fora do teclado), como um botão nativo", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="status">[\s\S]*?<button type="button" id="angle-unit" class="angle-unit" data-action="angle-unit"[^>]*>DEG<\/button>\s*<\/div>\s*<output id="display"/,
    );
  });

  test("o botão DEG/RAD tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.angle-unit:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });

  test("o botão DEG/RAD fica à direita da linha de status: .status com justify-content: flex-end", () => {
    assert.match(CSS_SOURCE, /\.status\s*\{[^}]*justify-content:\s*flex-end;[^}]*\}/);
  });
});

describe("CALC-32: teclado, foco e estrutura do cos", () => {
  test("cos não tem tecla própria: Enter com o foco no botão cos não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão cos na grade científica, entre sen e tan, fora do teclado, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="sine-button"[^>]*>sen<\/button>\s*<button type="button" id="cos-button" class="cos-add" data-action="cos" aria-label="Cosseno \(cos\)">cos<\/button>\s*<button type="button" id="tan-button"[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o cos usa o mesmo estilo de pílula cinza escuro da grade científica e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.scientific > button\s*\{[^}]*border-radius:\s*999px;[^}]*background:\s*#333333;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-36: critérios de aceite do π", () => {
  test("π mostra 3.14159265 (8 casas, como os resultados): π resulta em 3.14159265", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("π"), "3.14159265");
  });

  test("2 × π funciona: 2, ×, π, = resulta em 6.2831853", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "×", "π", "="), "6.2831853");
  });
});

describe("CALC-36: casos de borda do π", () => {
  test("π substitui o número em curso, como o sen: 5, π mostra 3.14159265", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "π"), "3.14159265");
  });

  test("π depois do igual começa um número novo: 2 + 3 =, π mostra 3.14159265", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "π"), "3.14159265");
  });

  test("π após Erro reinicia a calculadora: 5 ÷ 0 =, π mostra 3.14159265", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "π"), "3.14159265");
  });

  test("com 9 dígitos, o próximo dígito é ignorado: π, 5 continua 3.14159265", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("π", "5"), "3.14159265");
  });

  test("π no segundo operando usa o valor completo: 2 + π = mostra 5.14159265 e grava 2 + 3.14159265 = 5.14159265", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("2", "+", "π", "="), "5.14159265");
    assert.deepEqual(calc.historyItems(), ["2 + 3.14159265 = 5.14159265"]);
  });

  test("o visor de 10 caracteres usa a fonte de 40px: π usa display-40", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("π");
    assert.equal(calc.fontSizeClass(), "display-40");
  });

  test("π sozinho não grava no histórico nem mexe na memória: 5 M+, AC, π mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "π");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-36: teclado, foco e estrutura do π", () => {
  test("Enter com o foco no botão π não vira igual, o cálculo em curso fica (a tecla própria é p, CALC-42)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão π na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="pi-button" class="pi-add" data-action="pi" aria-label="Inserir pi \(π\)">π<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o π tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-37: critérios de aceite do e (número de Euler)", () => {
  test("e mostra 2.71828183 (8 casas, como os resultados): e resulta em 2.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e"), "2.71828183");
  });

  // e² sai de e seguido de x² (o botão x² eleva o valor completo de e ao quadrado).
  test("e elevado a 2 usa o valor correto: e, x² resulta em 7.3890561 (e² = 7.38905610, sem zero à direita)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "x²"), "7.3890561");
  });
});

describe("CALC-37: casos de borda do e", () => {
  test("e substitui o número em curso, como o π: 5, e mostra 2.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "e"), "2.71828183");
  });

  test("e depois do igual começa um número novo: 2 + 3 =, e mostra 2.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "e"), "2.71828183");
  });

  test("e após Erro reinicia a calculadora: 5 ÷ 0 =, e mostra 2.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "e"), "2.71828183");
  });

  test("com 9 dígitos, o próximo dígito é ignorado: e, 5 continua 2.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "5"), "2.71828183");
  });

  test("e no segundo operando usa o valor exibido: 2 + e = mostra 4.71828183 e grava 2 + 2.71828183 = 4.71828183", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("2", "+", "e", "="), "4.71828183");
    assert.deepEqual(calc.historyItems(), ["2 + 2.71828183 = 4.71828183"]);
  });

  test("e é um operando comum: e, 1/x resulta em 0.36787944", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "1/x"), "0.36787944");
  });

  test("as contas de e usam o valor completo, não o visor de 8 casas: e, x² resulta em 7.3890561 (não 7.38905611)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "x²"), "7.3890561");
  });

  test("−e usa o valor completo: e, +/-, x² resulta em 7.3890561", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "+/-", "x²"), "7.3890561");
  });

  test("um 2.71828183 digitado não é o número de Euler: 2.71828183, x² resulta em 7.38905611", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", ".", "7", "1", "8", "2", "8", "1", "8", "3", "x²"), "7.38905611");
  });

  test("apagar um dígito de e e digitá-lo de volta tira o valor completo: e, Backspace, 3, x² resulta em 7.38905611", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("e");
    assert.equal(calc.type("Backspace", "3"), "2.71828183");
    assert.equal(calc.press("x²"), "7.38905611");
  });

  test("o visor de 10 caracteres usa a fonte de 40px: e usa display-40", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("e");
    assert.equal(calc.fontSizeClass(), "display-40");
  });

  test("e sozinho não grava no histórico nem mexe na memória: 5 M+, AC, e mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "e");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-37: teclado, foco e estrutura do e", () => {
  // O botão e existe na linha da memória (é clicado pelo press("e")); só não tem tecla no teclado físico.
  test("o botão e não tem tecla no teclado físico: Enter com o foco no botão e não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão e na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="e-button" class="e-add" data-action="euler" aria-label="Inserir número de Euler \(e\)">e<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o e tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-38: critérios de aceite do 1/x", () => {
  test("1/x de 4 = 0.25 (ponto decimal, como nos demais resultados): 4, 1/x resulta em 0.25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("4", "1/x"), "0.25");
  });

  test("1/x de 0 mostra Erro: 0, 1/x resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "1/x"), "Erro");
  });
});

describe("CALC-38: casos de borda do 1/x", () => {
  test("1/x de número negativo segue a fórmula: 2, +/-, 1/x resulta em -0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+/-", "1/x"), "-0.5");
  });

  test("1/x de 3 arredonda a 8 casas: 3, 1/x resulta em 0.33333333", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "1/x"), "0.33333333");
  });

  test("1/x de 0.5 resulta em 2: 0, ., 5, 1/x resulta em 2", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "1/x"), "2");
  });

  test("1/x de 0. também é zero e mostra Erro: 0, ., 1/x resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "1/x"), "Erro");
  });

  test("+/- no zero não cria -0, então 0, +/-, 1/x ainda é zero e mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "+/-", "1/x"), "Erro");
  });

  test("1/x de 0.00000001 resulta em 100000000 (sem notação científica)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "0", "0", "0", "0", "0", "0", "0", "1", "1/x"), "100000000");
  });

  test("resultado que some no arredondamento mostra 0: 999999999, 1/x resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "1/x"), "0");
  });

  test("1/x duas vezes volta ao número original: 4, 1/x, 1/x resulta em 4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("4", "1/x", "1/x"), "4");
  });

  test("1/x depois do operador vira o segundo operando, como o % e o sen: 2, +, 4, 1/x, = resulta em 2.25", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("2", "+", "4", "1/x", "="), "2.25");
    assert.deepEqual(calc.historyItems(), ["2 + 0.25 = 2.25", "1/4 = 0.25"]);
  });

  test("1/x depois do igual calcula o resultado: 2 + 2 =, 1/x mostra 0.25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "2", "=", "1/x"), "0.25");
  });

  test("com Erro no visor, 1/x mantém o Erro e a próxima tecla reinicia: 5 ÷ 0 =, 1/x mostra Erro, 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "1/x"), "Erro");
    assert.equal(calc.press("7"), "7");
  });

  test("1/x grava a própria linha no histórico e não mexe na memória (CALC-43): 5 M+, AC, 4 1/x grava 1/4 = 0.25 e mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "4", "1/x");
    assert.deepEqual(calc.historyItems(), ["1/4 = 0.25"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["1/4 = 0.25"]);
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-38: teclado, foco e estrutura do 1/x", () => {
  test("1/x não tem tecla própria: Enter com o foco no botão 1/x não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão 1/x na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="inverse-button" class="inverse-add" data-action="inverse" aria-label="Inverso \(1\/x\)">1\/x<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o 1/x tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-27: critérios de aceite do √x", () => {
  test("√16 = 4: 1, 6, √x resulta em 4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "6", "√x"), "4");
  });

  test("√2 mostra 1.41421356 (8 casas, 9 algarismos, dentro do limite) e usa a fonte de 40px", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "√x"), "1.41421356");
    assert.equal(calc.fontSizeClass(), "display-40");
  });

  test("√(-1) mostra Erro: 1, +/-, √x resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+/-", "√x"), "Erro");
  });
});

describe("CALC-27: casos de borda do √x", () => {
  test("√0 = 0: 0, √x resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "√x"), "0");
  });

  test("√0.25 = 0.5: 0, ., 2, 5, √x resulta em 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "2", "5", "√x"), "0.5");
  });

  test("√0.00000001 = 0.0001 (sem notação científica): 0, ., 0 ×7, 1, √x resulta em 0.0001", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "0", "0", "0", "0", "0", "0", "0", "1", "√x"), "0.0001");
  });

  test("√3 arredonda a 8 casas: 3, √x resulta em 1.73205081", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "√x"), "1.73205081");
  });

  test("raiz de número negativo com decimal também mostra Erro: 0, ., 5, +/-, √x resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "+/-", "√x"), "Erro");
  });

  test("raiz exata de número grande: 99980001, √x resulta em 9999", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "9", "9", "8", "0", "0", "0", "1", "√x"), "9999");
  });

  test("√x duas vezes: 16, √x, √x resulta em 2", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "6", "√x", "√x"), "2");
  });

  test("√x depois do operador vira o segundo operando, como o 1/x: 2, +, 9, √x, = resulta em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("2", "+", "9", "√x", "="), "5");
    assert.deepEqual(calc.historyItems(), ["2 + 3 = 5", "√9 = 3"]);
  });

  test("√x depois do igual calcula o resultado: 2 + 2 =, √x mostra 2", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "2", "=", "√x"), "2");
  });

  test("com Erro no visor, √x mantém o Erro: 1, +/-, √x, √x mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+/-", "√x", "√x"), "Erro");
  });

  test("a próxima tecla após o Erro do √x reinicia a calculadora: 1, +/-, √x, 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+/-", "√x", "7"), "7");
  });

  test("√x grava a própria linha no histórico e não mexe na memória (CALC-43): 5 M+, AC, 4 √x grava √4 = 2 e mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "4", "√x");
    assert.deepEqual(calc.historyItems(), ["√4 = 2"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["√4 = 2"]);
    assert.equal(calc.memoryValue(), 5);
  });
});

// CALC-49: √x e cos usam o valor completo de e (Math.E), como as demais contas, e trocam o visor pelo resultado.
describe("CALC-49: √x e cos com e usam o valor completo", () => {
  // Mesmo formato do visor: 8 casas, sem zeros à direita.
  const formatted = (value) => value.toFixed(8).replace(/\.?0+$/, "");

  test("√e usa o valor completo: e, √x resulta em 1.64872127 (√ de Math.E)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "√x"), formatted(Math.sqrt(Math.E)));
  });

  test("depois de e, √x, o visor é o operando: e, √x, x² resulta em 2.71828183 (não 7.3890561 de e²)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "√x", "x²"), "2.71828183");
  });

  test("cos usa o valor completo de e: e, cos resulta no cosseno de Math.E graus", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "cos"), formatted(Math.cos((Math.E * Math.PI) / 180)));
  });

  test("depois de e, cos, o visor é o operando: e, cos, x² não usa e² (não mostra 7.3890561)", () => {
    const calc = createCalculator({ storage: {} });
    assert.notEqual(calc.press("e", "cos", "x²"), "7.3890561");
  });
});

describe("CALC-27: teclado, foco e estrutura do √x", () => {
  test("√x não tem tecla própria: Enter com o foco no botão √x não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão √x na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="sqrt-button" class="sqrt-add" data-action="sqrt" aria-label="Raiz quadrada \(√x\)">√x<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o √x tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-23: critérios de aceite do M-", () => {
  test("memória 8 e visor 3, M- deixa a memória em 5: 8, M+, AC, 3, M- mostra 3 e memória 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("8", "M+", "AC", "3", "M-"), "3");
    assert.equal(calc.memoryValue(), 5);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("M- não muda o visor nem o operador pendente: 2, +, 3, M-, = resulta em 5 e a memória fica em -3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "M-", "="), "5");
    assert.equal(calc.memoryValue(), -3);
  });

  test("M- não entra no histórico de cálculos: 5, M- não grava nada", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M-");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });
});

describe("CALC-23: casos de borda do M-", () => {
  test("memória vazia conta como 0: 3, M- deixa a memória em -3 e o indicador visível", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "M-"), "3");
    assert.equal(calc.memoryValue(), -3);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("zero no visor não muda a memória: 5, M+, AC, M- mantém a memória em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "M-"), "0");
    assert.equal(calc.memoryValue(), 5);
  });

  test("memória que volta a 0 esconde o indicador: 5, M+, AC, 5, M- deixa a memória em 0 e o indicador escondido", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC", "5", "M-");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("M- seguido de M+ com o mesmo visor volta à memória original: 8, M+, AC, 3, M-, M+ deixa a memória em 8", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("8", "M+", "AC", "3", "M-", "M+");
    assert.equal(calc.memoryValue(), 8);
  });

  test("decimais sem ruído de ponto flutuante: 0.3, M+, AC, 0.1, M- deixa a memória em 0.2", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("0", ".", "3", "M+", "AC", "0", ".", "1", "M-");
    assert.equal(calc.memoryValue(), 0.2);
  });

  test("valor negativo no visor soma à memória: 5, M+, AC, 8, +/-, M- deixa a memória em 13", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "8", "+/-", "M-"), "-8");
    assert.equal(calc.memoryValue(), 13);
  });

  test("com Erro no visor, M- não faz nada: 5, M+, AC, 5, ÷, 0, =, M- mantém o Erro e a memória em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "5", "÷", "0", "=", "M-"), "Erro");
    assert.equal(calc.memoryValue(), 5);
  });

  test("resultado acima de 2^53 mostra Erro e a memória fica como estava: memória 9007199136250225, visor -9007199136250225, M- mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "=", "M+", "AC");
    calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "=", "+/-");
    assert.equal(calc.press("M-"), "Erro");
    assert.equal(calc.memoryValue(), 9007199136250225);
  });

  test("a próxima tecla depois do Erro de memória reinicia a calculadora: depois do erro, 7 resulta em 7 e a memória continua", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "=", "M+", "AC");
    calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "=", "+/-", "M-");
    assert.equal(calc.press("7"), "7");
    assert.equal(calc.memoryValue(), 9007199136250225);
  });
});

describe("CALC-23: teclado, foco e estrutura do M-", () => {
  test("a tecla - segue como subtração e não mexe na memória: 5, M+, AC, 8, -, 3, = resulta em 5 (M- é _, CALC-42)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC", "8");
    assert.equal(calc.type("-", "3", "="), "5");
    assert.equal(calc.memoryValue(), 5);
  });

  test("Enter com o foco no M- não vira igual: o botão é que age (clique nativo), o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão M- ao lado do M+, na linha da memória, fora do teclado, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">\s*(?:<button type="button" id="memory-clear"[^>]*>MC<\/button>\s*)?<button type="button" id="memory-recall"[^>]*>MR<\/button>\s*<button type="button" id="memory-add"[^>]*>M\+<\/button>\s*<button type="button" id="memory-subtract" class="memory-subtract" data-action="memory-subtract" aria-label="Subtrair da memória \(M-\)">M-<\/button>\s*<button type="button" id="square-button"[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o M- usa o estilo da grade científica (cinza escuro, formato redondo) e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.scientific > button\s*\{[^}]*border-radius:\s*999px;[^}]*background:\s*#333333;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });

  test("a grade científica tem 3 colunas do mesmo lado dos botões do teclado, à esquerda dele: .scientific antes de .keypad no DOM", () => {
    assert.match(CSS_SOURCE, /\.scientific\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*var\(--cell\)\);[^}]*\}/);
    assert.match(HTML_SOURCE, /<div class="panel">\s*<div class="scientific">[\s\S]*?<\/div>\s*<div class="keypad">/);
  });
});

describe("CALC-24: critérios de aceite do MR", () => {
  test("memória 5, MR mostra 5: 5, M+, AC, MR mostra 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "MR"), "5");
    assert.equal(calc.memoryValue(), 5);
  });

  test("memória 5, MR + 2 = resulta em 7: 5, M+, AC, MR, +, 2, = mostra 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "MR", "+", "2", "="), "7");
  });

  test("MR depois de operador vira o segundo operando: 5, M+, AC, 2, +, MR, = mostra 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "2", "+", "MR", "="), "7");
  });
});

describe("CALC-24: casos de borda do MR", () => {
  test("memória vazia conta como 0: 7, MR mostra 0 e o indicador continua escondido", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("7", "MR"), "0");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("MR não muda a memória: 5, M+, AC, MR, MR mantém a memória em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "MR", "MR"), "5");
    assert.equal(calc.memoryValue(), 5);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("MR substitui o número em curso: 5, M+, AC, 3, MR mostra 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "3", "MR"), "5");
  });

  test("memória negativa aparece com sinal: 3, M-, MR mostra -3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "M-", "MR"), "-3");
    assert.equal(calc.memoryValue(), -3);
  });

  test("memória decimal aparece sem ruído de ponto flutuante: 0.1, M+, 0.2, M+, AC, MR mostra 0.3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "1", "M+", "AC", "0", ".", "2", "M+", "AC", "MR"), "0.3");
    assert.equal(calc.memoryValue(), 0.3);
  });

  test("memória grande (até 2^53) aparece sem Erro: 94906265 × 94906265 =, M+, AC, MR mostra 9007199136250225", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("9", "4", "9", "0", "6", "2", "6", "5", "×", "9", "4", "9", "0", "6", "2", "6", "5", "=", "M+", "AC");
    assert.equal(calc.press("MR"), "9007199136250225");
  });

  test("com Erro no visor, MR começa uma calculadora nova com a memória: 5, M+, AC, 5, ÷, 0, =, MR mostra 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "5", "÷", "0", "=", "MR"), "5");
    assert.equal(calc.memoryValue(), 5);
  });

  test("com Erro no visor e memória vazia, MR mostra 0 e a conta volta ao normal: 5, ÷, 0, =, MR, 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "MR"), "0");
    assert.equal(calc.press("7"), "7");
  });

  test("depois do MR o próximo dígito continua o número recuperado, como o π: 5, M+, AC, MR, 3 mostra 53", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "MR", "3"), "53");
  });

  test("MR não entra no histórico de cálculos: 5, M+, AC, MR não grava nada", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "MR");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });
});

describe("CALC-24: teclado, foco e estrutura do MR", () => {
  test("Enter com o foco no MR não vira igual, o cálculo em curso fica (a tecla própria é r, CALC-42)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão MR antes do M+, na linha da memória, fora do teclado, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">\s*(?:<button type="button" id="memory-clear"[^>]*>MC<\/button>\s*)?<button type="button" id="memory-recall" class="memory-recall" data-action="memory-recall" aria-label="Recuperar memória \(MR\)">MR<\/button>\s*<button type="button" id="memory-add"/,
    );
  });

  test("o MR usa o estilo da grade científica (cinza escuro, formato redondo) e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.scientific > button\s*\{[^}]*border-radius:\s*999px;[^}]*background:\s*#333333;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-33: critérios de aceite da tangente (tan, em graus)", () => {
  test("tan(45°) = 1: 4, 5, tan resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("4", "5", "tan"), "1");
  });

  test("tan(90°) mostra Erro: 9, 0, tan resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "0", "tan"), "Erro");
  });
});

describe("CALC-33: casos de borda da tangente", () => {
  test("múltiplos de 45° saem exatos, sem 0.9999999999999999: 135 resulta em -1 e 225 em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "3", "5", "tan"), "-1");
    assert.equal(calc.press("AC", "2", "2", "5", "tan"), "1");
  });

  test("tan 0° e tan 180° resultam em 0 (sem -0), e tan 360° também: 0 tan, 1 8 0 tan, 3 6 0 tan", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "tan"), "0");
    assert.equal(calc.press("AC", "1", "8", "0", "tan"), "0");
    assert.equal(calc.press("AC", "3", "6", "0", "tan"), "0");
  });

  test("a tangente é indefinida em 90° + 180°·k: 270, -90 e -270 mostram Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "7", "0", "tan"), "Erro");
    assert.equal(calc.press("AC", "9", "0", "+/-", "tan"), "Erro");
    assert.equal(calc.press("AC", "2", "7", "0", "+/-", "tan"), "Erro");
  });

  test("ângulo negativo usa a redução módulo 180: -45 resulta em -1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("4", "5", "+/-", "tan"), "-1");
  });

  test("ângulo fora de 0 a 180 é reduzido: 225 resulta em 1 e 135 em -1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "2", "5", "tan"), "1");
    assert.equal(calc.press("AC", "1", "3", "5", "tan"), "-1");
  });

  test("valores não exatos seguem o arredondamento de 8 casas: tan 30° = 0.57735027, tan 60° = 1.73205081, tan 10° = 0.17632698", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "0", "tan"), "0.57735027");
    assert.equal(calc.press("AC", "6", "0", "tan"), "1.73205081");
    assert.equal(calc.press("AC", "1", "0", "tan"), "0.17632698");
  });

  test("tan 1° e tan 5° arredondam a 8 casas: 1 tan mostra 0.01745506 e 5 tan mostra 0.08748866", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "tan"), "0.01745506");
    assert.equal(calc.press("AC", "5", "tan"), "0.08748866");
  });

  test("ângulo grande com precisão: tan 999999999° = -6.31375151 (módulo 180 antes da tangente)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "tan"), "-6.31375151");
  });

  test("tan depois do operador vira o segundo operando, como o sen: 2, +, 4, 5, tan, = resulta em 3", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("2", "+", "4", "5", "tan", "="), "3");
    assert.deepEqual(calc.historyItems(), ["2 + 1 = 3", "tan(45) = 1"]);
  });

  test("tan depois do igual calcula o resultado: 2 + 3 =, tan mostra 0.08748866", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "tan"), "0.08748866");
  });

  test("com Erro no visor, tan mantém o Erro e a próxima tecla reinicia: 5 ÷ 0 =, tan mostra Erro, 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "tan"), "Erro");
    assert.equal(calc.press("7"), "7");
  });

  test("tan em radianos: unidade, 1, tan resulta em 1.55740772 (tan 1 rad), e a unidade continua RAD", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "1", "tan"), "1.55740772");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });

  test("tan em radianos usa o valor do visor como radianos, não graus: unidade, 4, 5, tan resulta em 1.61977519 (tan 45 rad)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "4", "5", "tan"), "1.61977519");
  });

  test("tan em radianos de 0 e de negativos: unidade, 0, tan resulta em 0; unidade, 1, +/-, tan resulta em -1.55740772", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "0", "tan"), "0");
    assert.equal(calc.press("AC", "1", "+/-", "tan"), "-1.55740772");
  });

  test("tan em radianos depois do operador vira o segundo operando: unidade, 2, +, 1, tan, = resulta em 3.55740772 (2 + tan 1 rad)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "2", "+", "1", "tan", "="), "3.55740772");
  });

  test("trocar a unidade não recalcula o tan já mostrado: 1, tan mostra 0.01745506, unidade mantém 0.01745506", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "tan"), "0.01745506");
    assert.equal(calc.press("unidade"), "0.01745506");
  });

  test("tan em radianos de π/4 com o π de 8 casas: unidade, π, ÷, 4, =, tan resulta em 0.99999999 (π ÷ 4 vira 0.78539816 no visor, e a tangente dele fica abaixo de 1 nas 8 casas)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("unidade", "π", "÷", "4", "=");
    assert.equal(calc.press("tan"), "0.99999999");
  });

  test("tan em radianos de π/2 mostra Erro: unidade, π, ÷, 2, =, tan resulta em Erro (π/2 não tem tangente)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("unidade", "π", "÷", "2", "=");
    assert.equal(calc.press("tan"), "Erro");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });

  test("tan em radianos de π/2 com 8 casas mostra Erro, e -π/2 também: unidade, 1.57079633, tan resulta em Erro; AC, unidade, 1.57079633, +/-, tan resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("unidade", "1", ".", "5", "7", "0", "7", "9", "6", "3", "3", "tan"), "Erro");
    assert.equal(calc.press("AC", "1", ".", "5", "7", "0", "7", "9", "6", "3", "3", "+/-", "tan"), "Erro");
  });

  test("tan em radianos perto de π/2 mas não dentro da 8ª casa segue a conta: unidade, 1.5707963, tan não mostra Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.notEqual(calc.press("unidade", "1", ".", "5", "7", "0", "7", "9", "6", "3", "tan"), "Erro");
  });

  test("tan grava a própria linha no histórico e não mexe na memória (CALC-43): 5 M+, AC, 4 5 tan grava tan(45) = 1 e mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "4", "5", "tan");
    assert.deepEqual(calc.historyItems(), ["tan(45) = 1"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["tan(45) = 1"]);
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-33: teclado, foco e estrutura do tan", () => {
  test("tan não tem tecla própria: Enter com o foco no botão tan não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão tan na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="tan-button" class="tan-add" data-action="tan" aria-label="Tangente \(tan\)">tan<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o tan tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-25: critérios de aceite do MC", () => {
  test("após MC, MR mostra 0: 5, M+, AC, MC, MR mostra 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "MC", "MR"), "0");
    assert.equal(calc.memoryValue(), 0);
  });

  test("após MC, o indicador de memória some: 5, M+, AC, MC deixa o indicador escondido", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC");
    assert.equal(calc.memoryIndicatorHidden(), false);
    calc.press("MC");
    assert.equal(calc.memoryIndicatorHidden(), true);
  });
});

describe("CALC-25: casos de borda do MC", () => {
  test("MC com memória vazia não faz nada: 7, MC mantém o visor em 7, a memória em 0 e o indicador escondido", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("7", "MC"), "7");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("MC não muda o visor: 5, M+, AC, 3, MC mostra 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "3", "MC"), "3");
  });

  test("MC zera uma memória negativa: 3, M-, MC, MR mostra 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "M-", "MC", "MR"), "0");
    assert.equal(calc.memoryValue(), 0);
  });

  test("MC com Erro no visor zera a memória e mantém o Erro: 5, M+, AC, 5, ÷, 0, =, MC mantém Erro, memória 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "5", "÷", "0", "=", "MC"), "Erro");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("depois do MC, M+ parte do zero: 5, M+, AC, MC, 2, M+ deixa a memória em 2", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC", "MC", "2", "M+");
    assert.equal(calc.memoryValue(), 2);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("MC repetido segue com memória 0: 5, M+, AC, MC, MC deixa a memória em 0", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC", "MC", "MC");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("MC não entra no histórico de cálculos: 5, M+, AC, MC não grava nada", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "MC");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });
});

describe("CALC-25: teclado, foco e estrutura do MC", () => {
  test("MC tem tecla c (CALC-42): a tecla c zera a memória e o indicador some", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC");
    calc.type("c");
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.memoryIndicatorHidden(), true);
  });

  test("index.html tem o botão MC antes do MR, na linha da memória, fora do teclado, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">\s*<button type="button" id="memory-clear" class="memory-clear" data-action="memory-clear" aria-label="Limpar memória \(MC\)">MC<\/button>\s*<button type="button" id="memory-recall"/,
    );
  });

  test("o MC usa o estilo da grade científica (cinza escuro, formato redondo) e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.scientific > button\s*\{[^}]*border-radius:\s*999px;[^}]*background:\s*#333333;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

// CALC-42: teclas das funções avançadas (^ xʸ, p π, ! x!, r MR, c MC, _ M-) e a lista de atalhos na tela.
describe("CALC-42: critérios de aceite dos atalhos das funções avançadas", () => {
  test("^ é potência: 2 ^ 3 = resulta em 8", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("2", "^", "3", "="), "8");
  });

  test("p insere π: p mostra 3.14159265", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("p"), "3.14159265");
  });

  test("! é fatorial: 5 ! resulta em 120", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("5", "!"), "120");
  });

  test("r recupera a memória: 5, M+, AC, r mostra 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC");
    assert.equal(calc.type("r"), "5");
  });

  test("_ subtrai o visor da memória: 5, M+, AC, 8, _ deixa a memória em -3", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC");
    calc.type("8", "_");
    assert.equal(calc.memoryValue(), -3);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("as teclas em maiúscula valem como as minúsculas: P insere π, R recupera e C limpa a memória", () => {
    assert.equal(createCalculator({ storage: {} }).type("P"), "3.14159265");
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC");
    assert.equal(calc.type("R"), "5");
    assert.equal(calc.type("C"), "5");
    assert.equal(calc.memoryValue(), 0);
  });

  test("parênteses e potência juntos: ( 2 + 3 ) ^ 2 = resulta em 25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("(", "2", "+", "3", ")", "^", "2", "="), "25");
  });

  test("a potência associa à direita pelo teclado: 2 ^ 3 ^ 2 = resulta em 512", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("2", "^", "3", "^", "2", "="), "512");
  });

  test("^ seguido de outro ^ só troca o operador: 2 ^ ^ 3 = resulta em 8", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("2", "^", "^", "3", "="), "8");
  });

  test("! depois de um número no meio da conta: 3 + 4 ! = resulta em 27", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("3", "+", "4", "!", "="), "27");
  });

  test("! com negativo mostra Erro, como o botão x!: 1, +/-, ! resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "+/-");
    assert.equal(calc.type("!"), "Erro");
  });

  test("atalhos atuais continuam: ( ) * e Enter funcionam como antes", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("(", "2", "+", "3", ")", "*", "4", "="), "20");
    assert.equal(createCalculator().type("7", "-", "2", "Enter"), "5");
    assert.equal(createCalculator().type("8", "/", "2", "="), "4");
  });

  test("Escape continua limpando e m continua somando à memória: 5, m, Escape deixa a memória em 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.type("5", "m", "Escape");
    assert.equal(calc.memoryValue(), 5);
    assert.equal(calc.display(), "0");
  });

  test("tecla pressionada marca o botão correspondente: p marca π, r marca MR e ^ marca xʸ", () => {
    const calc = createCalculator({ storage: {} });
    calc.keyDown("p", { code: "KeyP" });
    assert.equal(calc.buttonFor("π").classList.contains("is-pressed"), true);
    calc.keyUp("p", "KeyP");
    assert.equal(calc.buttonFor("π").classList.contains("is-pressed"), false);
    calc.keyDown("r", { code: "KeyR" });
    assert.equal(calc.buttonFor("MR").classList.contains("is-pressed"), true);
    calc.keyUp("r", "KeyR");
    calc.keyDown("^", { code: "Digit6" });
    assert.equal(calc.buttonFor("xʸ").classList.contains("is-pressed"), true);
    calc.keyUp("^", "Digit6");
    assert.equal(calc.buttonFor("xʸ").classList.contains("is-pressed"), false);
  });

  test("lista de atalhos na tela: section com título e uma tecla (kbd) para cada atalho", () => {
    assert.match(HTML_SOURCE, /<section class="shortcuts" aria-labelledby="shortcuts-title">/);
    assert.match(HTML_SOURCE, /<h2 id="shortcuts-title" class="shortcuts-title">Atalhos de teclado<\/h2>/);
    assert.ok(HTML_SOURCE.includes("<kbd>(</kbd> <kbd>)</kbd>"));
    for (const key of ["^", "p", "!", "m", "_", "r", "c"]) {
      assert.ok(HTML_SOURCE.includes(`<kbd>${key}</kbd>`), `atalho ${key} na lista`);
    }
  });

  test("a lista fica dentro da calculadora, depois do teclado, e some no mobile", () => {
    assert.match(HTML_SOURCE, /<\/div>\s*<section class="shortcuts"[\s\S]*<\/section>\s*<\/main>/);
    assert.match(CSS_SOURCE, /\.shortcuts\s*\{[^}]*color:\s*#a5a5a5;[^}]*\}/);
    assert.match(MOBILE_CSS, /\.shortcuts\s*\{\s*display:\s*none;\s*\}/);
  });
});

describe("CALC-30: critérios de aceite dos parênteses", () => {
  test("(2 + 3) × 4 = resulta em 20", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "×", "4", "="), "20");
  });

  test("((1+1)×3) = resulta em 6", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "(", "1", "+", "1", ")", "×", "3", ")", "="), "6");
  });

  test("parêntese não fechado é fechado ao calcular: ( 2 + 3 = resulta em 5 e grava (2 + 3) = 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", "="), "5");
    assert.deepEqual(calc.historyItems(), ["(2 + 3) = 5"]);
  });

  test("parêntese sobrando é ignorado: 2, ), +, 3, = resulta em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", ")", "+", "3", "="), "5");
  });
});

describe("CALC-30: casos de borda dos parênteses", () => {
  test("precedência dentro do grupo: 2 × (3 + 4) = resulta em 14", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "×", "(", "3", "+", "4", ")", "="), "14");
  });

  test("precedência com grupo à direita: 2 + (3 × 4) = resulta em 14", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "(", "3", "×", "4", ")", "="), "14");
  });

  test("aninhamento com dois grupos internos: ((2 + 3) × (4 − 1)) = resulta em 15", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "(", "2", "+", "3", ")", "×", "(", "4", "−", "1", ")", ")", "="), "15");
    assert.deepEqual(calc.historyItems(), ["((2 + 3) × (4 − 1)) = 15"]);
  });

  test("multiplicação implícita depois de número: 2 ( 3 + 1 ) = resulta em 8", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "(", "3", "+", "1", ")", "="), "8");
    assert.deepEqual(calc.historyItems(), ["2 × (3 + 1) = 8"]);
  });

  test("multiplicação implícita depois de grupo: (2 + 3) (4) = resulta em 20", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "(", "4", ")", "="), "20");
  });

  test("dígito logo depois de grupo multiplica o grupo: (2 + 3) 4 = resulta em 20", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "4", "="), "20");
  });

  test("operador depois do grupo continua a conta: (2 + 3) + 1 = resulta em 6", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "+", "1", "="), "6");
  });

  test("( no início não gera multiplicação por zero: ( 2 ) = resulta em 2 e grava (2) = 2", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", ")", "="), "2");
    assert.deepEqual(calc.historyItems(), ["(2) = 2"]);
  });

  test("grupo vazio é ignorado: 2, +, (, ), 3, = resulta em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "(", ")", "3", "="), "5");
  });

  test("operador logo depois de ( é ignorado: ( × 2 = resulta em 2", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "×", "2", "="), "2");
  });

  test("só parênteses e igual não quebram a tela: ( ( ) ) = resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "(", ")", ")", "="), "0");
  });

  test("divisão por zero dentro do grupo mostra Erro: ( 1 ÷ 0 ) resulta em Erro, e o próximo dígito reinicia", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "1", "÷", "0", ")"), "Erro");
    assert.equal(calc.press("7"), "7");
  });

  test("AC fecha todos os grupos: ( 2 AC 3 = resulta em 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "AC", "3", "="), "3");
  });

  test("depois do igual, ( começa uma conta nova: 2 + 3 =, ( 4 × 2 ) = resulta em 8", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=");
    assert.equal(calc.press("(", "4", "×", "2", ")", "="), "8");
    assert.deepEqual(calc.historyItems(), ["(4 × 2) = 8", "2 + 3 = 5"]);
  });

  test("função aplicada ao grupo age sobre o resultado: (2 + 3) % resulta em 0.05", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "%"), "0.05");
  });

  test("o histórico mostra o valor usado depois de uma função no grupo: 2 + (3 + 1) x² = grava 2 + 16 = 18", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "(", "3", "+", "1", ")", "x²", "="), "18");
    assert.deepEqual(calc.historyItems(), ["2 + 16 = 18"]);
  });

  test("√x aplicada ao grupo não grava o grupo no histórico: (2 + 3) √x = não cria item", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "√x", "="), "2.23606798");
    assert.deepEqual(calc.historyItems(), []);
  });

  test("√x no meio da conta usa o valor da raiz: 2 + (3 + 1) √x = grava 2 + 2 = 4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "(", "3", "+", "1", ")", "√x", "="), "4");
    assert.deepEqual(calc.historyItems(), ["2 + 2 = 4"]);
  });

  test("√x seguida de operador grava a raiz, não o grupo: (2 + 3) √x + 1 = grava 2.23606798 + 1 = 3.23606798", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "√x", "+", "1", "="), "3.23606798");
    assert.deepEqual(calc.historyItems(), ["2.23606798 + 1 = 3.23606798"]);
  });

  test("cos aplicado ao grupo usa o cosseno do grupo: (90 + 90) cos + 1 = resulta em 0 e grava -1 + 1 = 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "9", "0", "+", "9", "0", ")", "cos", "+", "1", "="), "0");
    assert.deepEqual(calc.historyItems(), ["-1 + 1 = 0"]);
  });

  test("cos aplicado ao grupo não grava o grupo no histórico: (90 + 90) cos = não cria item", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "9", "0", "+", "9", "0", ")", "cos", "="), "-1");
    assert.deepEqual(calc.historyItems(), []);
  });

  test("e substitui o grupo, como o π, sem multiplicação implícita: (2 + 3) e mostra 2.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "e"), "2.71828183");
  });

  test("e aplicado ao grupo não grava o grupo no histórico: (2 + 3) e = não cria item", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "e", "="), "2.71828183");
    assert.deepEqual(calc.historyItems(), []);
  });

  test("e depois do grupo entra na conta com o valor completo: (2 + 3) e + 1 = resulta em 3.71828183 e grava 2.71828183 + 1 = 3.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "e", "+", "1", "="), "3.71828183");
    assert.deepEqual(calc.historyItems(), ["2.71828183 + 1 = 3.71828183"]);
  });

  test("x! aplicado ao grupo não grava o grupo no histórico: (2 + 3) x! + 1 = grava 120 + 1 = 121", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "x!", "+", "1", "="), "121");
    assert.deepEqual(calc.historyItems(), ["120 + 1 = 121"]);
  });

  test("ln aplicado ao grupo não grava o grupo no histórico: (2 + 3) ln + 1 = grava 1.60943791 + 1 = 2.60943791", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("(", "2", "+", "3", ")", "ln", "+", "1", "="), "2.60943791");
    assert.deepEqual(calc.historyItems(), ["1.60943791 + 1 = 2.60943791"]);
  });
});

describe("CALC-30: teclado e indicador de parênteses abertos", () => {
  test("( e ) pelo teclado: ( 2 + 3 ) * 4 Enter resulta em 20", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type("(", "2", "+", "3", ")", "*", "4", "Enter"), "20");
  });

  test("( e ) pelo teclado são tratados como tecla da calculadora (defaultPrevented)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.keyDown("(").defaultPrevented, true);
    assert.equal(calc.keyDown(")").defaultPrevented, true);
  });

  test(") sobrando pelo teclado é ignorado: ) não muda o visor", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.type(")"), "0");
  });

  test("o indicador aparece com grupo aberto e mostra um ( por nível", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("(");
    assert.equal(calc.parenIndicatorHidden(), false);
    assert.equal(calc.parenSymbols(), "(");
    assert.equal(calc.parenText(), "1 parêntese aberto");
    calc.press("(");
    assert.equal(calc.parenSymbols(), "((");
    assert.equal(calc.parenText(), "2 parênteses abertos");
  });

  test("o indicador diminui ao fechar e some quando não há grupo aberto", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("(", "(", "1", ")");
    assert.equal(calc.parenSymbols(), "(");
    assert.equal(calc.parenText(), "1 parêntese aberto");
    calc.press(")");
    assert.equal(calc.parenIndicatorHidden(), true);
  });

  test("o indicador some depois do igual, que fecha os grupos: ( 2 + 3 = deixa o indicador escondido", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("(", "2", "+", "3", "=");
    assert.equal(calc.parenIndicatorHidden(), true);
  });
});

describe("CALC-30: estrutura e foco dos botões ( e )", () => {
  test("index.html tem os botões ( e ) na linha da memória, fora do teclado, com rótulo que traz o símbolo", () => {
    assert.match(
      HTML_SOURCE,
      /<button type="button" id="open-paren-button" class="paren-add" data-action="open-paren" aria-label="Abrir parêntese \(">\(<\/button>/,
    );
    assert.match(
      HTML_SOURCE,
      /<button type="button" id="close-paren-button" class="paren-add" data-action="close-paren" aria-label="Fechar parêntese \)">\)<\/button>/,
    );
  });

  test("os botões ( e ) têm o mesmo estilo de pílula cinza e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.paren-add\s*\{[^}]*border-radius:\s*999px;[^}]*color:\s*#a5a5a5;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.paren-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });

  test("o indicador de parênteses tem os símbolos escondidos do leitor de tela e o texto só para ele", () => {
    assert.match(
      HTML_SOURCE,
      /<span id="paren-indicator" class="paren-indicator" hidden><span id="paren-symbols" aria-hidden="true"><\/span><span id="paren-text" class="sr-only"><\/span><\/span>/,
    );
  });
});

describe("CALC-39: critérios de aceite do x! (fatorial)", () => {
  test("5 x! mostra 120", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "x!"), "120");
  });

  test("0 x! mostra 1 (0! = 1 por definição)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "x!"), "1");
  });

  test("1 x! mostra 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "x!"), "1");
  });

  test("10 x! mostra 3628800", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "x!"), "3628800");
  });

  test("valor negativo mostra Erro e não trava: 3, +/-, x! resulta em Erro, AC volta a 0 e 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "+/-", "x!"), "Erro");
    assert.equal(calc.press("AC"), "0");
    assert.equal(calc.press("7"), "7");
  });

  test("valor decimal mostra Erro: 2, ., 5, x! resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", ".", "5", "x!"), "Erro");
  });

  test("20 x! mostra notação científica: 2.4329020081766E+18", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "0", "x!"), "2.4329020081766E+18");
  });

  test("170 x! mostra um resultado válido em notação científica (≈ 7,257E+306)", () => {
    const calc = createCalculator({ storage: {} });
    assert.match(calc.press("1", "7", "0", "x!"), /^7\.2574156153\d*E\+306$/);
  });

  test("171 x! mostra Erro de overflow, e não Infinity nem NaN", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "7", "1", "x!"), "Erro");
  });

  test("depois de um erro, digitar um novo número volta ao normal: 171 x!, 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "7", "1", "x!", "7"), "7");
  });

  test("o resultado de x! é operando da operação seguinte: 5 x! + 10 = resulta em 130", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("5", "x!", "+", "1", "0", "="), "130");
    assert.deepEqual(calc.historyItems(), ["120 + 10 = 130", "5! = 120"]);
  });
});

describe("CALC-39: casos de borda do x!", () => {
  test("18 x! é o último inteiro exato por extenso: 6402373705728000", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "8", "x!"), "6402373705728000");
  });

  test("19 x! passa de 2^53 e vai para notação científica: 1.2164510040883E+17", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "9", "x!"), "1.2164510040883E+17");
  });

  test("3 x! = 6 e 3 x! × 4 = resulta em 24", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "x!"), "6");
    assert.equal(calc.press("×", "4", "="), "24");
  });

  test("x! de número com 0 à frente conta como 0: 0, 0, 3 x! resulta em 6", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "0", "3", "x!"), "6");
  });

  test("0.5 mostra Erro (decimal, mesmo sem parte inteira visível): 0, ., 5, x! resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "x!"), "Erro");
  });

  test("valor grande não trava: 999999999 x! resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("9", "9", "9", "9", "9", "9", "9", "9", "9", "x!"), "Erro");
  });

  test("com Erro no visor, x! mantém o Erro: 5 ÷ 0 =, x! resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "÷", "0", "=", "x!"), "Erro");
  });

  test("x! do resultado de um cálculo: 2 + 3 = depois x! resulta em 120", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "x!"), "120");
  });

  test("dígito depois de notação científica começa um número novo: 20 x!, 5 resulta em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "0", "x!", "5"), "5");
  });

  test("ponto depois de notação científica começa um número novo: 20 x!, ponto resulta em 0.", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "0", "x!", "."), "0.");
  });

  test("Backspace sobre notação científica não altera o resultado (CALC-65): 20 x!, Backspace mantém 2.4329020081766E+18", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "0", "x!");
    assert.equal(calc.type("Backspace"), "2.4329020081766E+18");
  });

  test("x! grava a própria linha no histórico (CALC-43): 5 x! grava 5! = 120", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "x!");
    assert.deepEqual(calc.historyItems(), ["5! = 120"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["5! = 120"]);
  });

  test("x! não mexe na memória, mas um resultado pode ir para ela: 5 x! M+ guarda 120", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "x!", "M+");
    assert.equal(calc.memoryValue(), 120);
  });

  test("M+ com x! acima de 2^53 mostra Erro e a memória não muda: 5 M+, AC, 1 9 x!, M+ resulta em Erro e memória 5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC", "1", "9", "x!");
    assert.equal(calc.press("M+"), "Erro");
    assert.equal(calc.memoryValue(), 5);
  });
});

describe("CALC-39: teclado, foco e estrutura do x!", () => {
  test("Enter com o foco no botão x! não vira igual, o cálculo em curso fica (a tecla própria é !, CALC-42)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão x! na grade científica (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="factorial-button" class="factorial-add" data-action="factorial" aria-label="Fatorial \(x!\)">x!<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o x! usa o mesmo estilo de pílula cinza escuro da grade científica e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.scientific > button\s*\{[^}]*border-radius:\s*999px;[^}]*background:\s*#333333;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-29: critérios de aceite do xʸ (potência)", () => {
  test("2 xʸ 10 = resulta em 1024", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "1", "0", "="), "1024");
  });

  test("a potência vem antes da soma: 2 + 3 xʸ 2 = resulta em 11", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "xʸ", "2", "="), "11");
  });

  test("expoente negativo: 2 xʸ -1 = resulta em 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "1", "+/-", "="), "0.5");
  });

  test("expoente decimal com raiz: 4 xʸ 0.5 = resulta em 2", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("4", "xʸ", "0", ".", "5", "="), "2");
  });

  test("resultado irracional arredondado a 8 casas: 2 xʸ 0.5 = resulta em 1.41421356", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "0", ".", "5", "="), "1.41421356");
  });

  test("0 xʸ 0 = resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "xʸ", "0", "="), "1");
  });

  test("base negativa com expoente fracionário mostra Erro, sem NaN: (-4) xʸ 0.5 = resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("4", "+/-", "xʸ", "0", ".", "5", "="), "Erro");
  });

  test("0 elevado a negativo mostra Erro: 0 xʸ -1 = resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "xʸ", "1", "+/-", "="), "Erro");
  });
});

describe("CALC-29: casos de borda do xʸ (potência)", () => {
  test("expoente zero: 5 xʸ 0 = resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "xʸ", "0", "="), "1");
  });

  test("base decimal: 0.5 xʸ 2 = resulta em 0.25", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "xʸ", "2", "="), "0.25");
  });

  test("base negativa com expoente inteiro é real: (-2) xʸ 3 = resulta em -8", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+/-", "xʸ", "3", "="), "-8");
  });

  test("resultado acima de 2^53 mostra Erro: 2 xʸ 100 = resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "1", "0", "0", "="), "Erro");
  });

  test("com Erro no visor, xʸ recomeça do zero como os outros operadores: 2 xʸ 100 =, xʸ, 3 = resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "1", "0", "0", "="), "Erro");
    assert.equal(calc.press("xʸ", "3", "="), "0");
  });

  test("× antes do xʸ: 2 × 3 xʸ 2 = resulta em 18 (2 × 9)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "×", "3", "xʸ", "2", "="), "18");
  });

  test("xʸ antes do ×: 2 xʸ 3 × 2 = resulta em 16 (8 × 2)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "3", "×", "2", "="), "16");
  });

  test("xʸ antes da divisão: 8 ÷ 2 xʸ 2 = resulta em 2 (8 ÷ 4)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("8", "÷", "2", "xʸ", "2", "="), "2");
  });

  test("xʸ com termo já fechado: 1 + 2 xʸ 3 × 2 = resulta em 17 (1 + 8 × 2)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+", "2", "xʸ", "3", "×", "2", "="), "17");
  });

  test("xʸ é associado à direita: 2 xʸ 3 xʸ 2 = resulta em 512 (2 xʸ 9), e não 64", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "3", "xʸ", "2", "="), "512");
  });

  test("xʸ encadeado mostra o último número fechado, não o resultado parcial: 2 xʸ 3 xʸ mostra 3", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "3", "xʸ"), "3");
  });

  test("apertar + depois do xʸ mostra o parcial: 2 xʸ 3 + mostra 8 e resulta em 9", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "xʸ", "3", "+"), "8");
    assert.equal(calc.press("1", "="), "9");
  });

  test("trocar o operador antes do segundo número substitui o xʸ: 2 × xʸ 3 = resulta em 8", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "×", "xʸ", "3", "="), "8");
  });

  test("igual logo após xʸ repete o número: 3 xʸ = resulta em 27", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "xʸ", "="), "27");
  });

  test("xʸ não mexe na memória: 5 M+, AC, 2 xʸ 3 = mostra 8 e a memória fica em 5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "M+", "AC", "2", "xʸ", "3", "="), "8");
    assert.equal(calc.memoryValue(), 5);
  });

  test("a conta entra no histórico com o símbolo xʸ: 2 xʸ 10 = grava 2 xʸ 10 = 1024", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "xʸ", "1", "0", "=");
    assert.deepEqual(calc.historyItems(), ["2 xʸ 10 = 1024"]);
  });

  test("xʸ pendente fica destacado até o segundo número: 2 xʸ destaca o xʸ, 3 remove o destaque", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "xʸ");
    assert.deepEqual(calc.selectedOperator(), ["xʸ"]);
    calc.press("3");
    assert.deepEqual(calc.selectedOperator(), []);
  });
});

describe("CALC-29: teclado, foco e estrutura do xʸ", () => {
  test("Enter com o foco no botão xʸ não vira igual, o cálculo em curso fica (a tecla própria é ^, CALC-42)", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão xʸ na linha da memória (fora do teclado), depois do tan, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="tan-button"[^>]*>tan<\/button>\s*<button type="button" id="power-button" class="power-add" data-action="power" aria-label="Elevar à potência \(xʸ\)">xʸ<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o xʸ tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.scientific > button:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });

  test("o xʸ pendente tem o destaque de operador do teclado (texto laranja sobre branco)", () => {
    assert.match(CSS_SOURCE, /\.power-add\[aria-pressed="true"\]\s*\{[^}]*background:\s*#ffffff;[^}]*color:\s*#b35c00;/);
  });
});

// CALC-35: ln (logaritmo natural). ln(e) é conferido tanto com o número digitado 2,71828182 (arredonda para 1 nas 8 casas)
// quanto com a tecla e, que usa o valor completo da constante (CALC-37).
describe("CALC-35: critérios de aceite do ln (logaritmo natural)", () => {
  test("ln(e) = 1: 2,71828182, ln resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", ".", "7", "1", "8", "2", "8", "1", "8", "2", "ln"), "1");
  });

  test("ln(e) = 1 pela tecla e: e, ln resulta em 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "ln"), "1");
  });

  // Regressão: ln com a constante e não pode deixar o valor completo de e ativo para a próxima conta.
  test("ln de e não deixa o valor completo de e para trás: e, ln, x² resulta em 1 (e não 7.3890561)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "ln", "x²"), "1");
  });

  test("ln de e não deixa o valor completo de e para trás: e, ln, log resulta em 0 (e não 0.43429448)", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "ln", "log"), "0");
  });

  test("ln(0) mostra Erro: 0, ln resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "ln"), "Erro");
  });

  test("ln(-1) mostra Erro: 1, +/-, ln resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "+/-", "ln"), "Erro");
  });
});

describe("CALC-35: casos de borda do ln (logaritmo natural)", () => {
  test("ln(1) = 0: 1, ln resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "ln"), "0");
  });

  test("ln(10) não exato segue a precisão do visor: 10, ln resulta em 2.30258509", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "0", "ln"), "2.30258509");
  });

  test("ln(2) não exato arredondado a 8 casas: 2, ln resulta em 0.69314718", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "ln"), "0.69314718");
  });

  test("valor entre 0 e 1 tem ln negativo: 0,5 ln resulta em -0.69314718", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "5", "ln"), "-0.69314718");
  });

  test("ln de valor logo acima de 1 fica sem notação científica: 1,00000001 ln resulta em 0.00000001", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", ".", "0", "0", "0", "0", "0", "0", "0", "1", "ln"), "0.00000001");
  });

  test("ln de valor abaixo de 1 perto do limite não mostra -0: 0,999999999 ln resulta em 0", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", ".", "9", "9", "9", "9", "9", "9", "9", "9", "9", "ln"), "0");
  });

  test("Erro reinicia com o próximo dígito: 0, ln, 7 resulta em 7", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "ln", "7"), "7");
  });

  test("ln com Erro no visor mantém o Erro: 0, ln, ln resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("0", "ln", "ln"), "Erro");
  });

  test("ln depois do igual usa o resultado: 2 + 3 =, ln resulta em 1.60943791", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "=", "ln"), "1.60943791");
  });

  test("ln no segundo operando entra na conta, como o log: 2 + ln =, resulta em 2.69314718", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "ln", "="), "2.69314718");
  });

  test("ln de zero dentro de uma conta mostra Erro: 2 + 0 ln resulta em Erro", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "0", "ln"), "Erro");
  });
});

// CALC-43: cada função avançada aplicada ao visor vira uma linha do histórico, "expressão = resultado" (mesmo texto do visor).
describe("CALC-43: critérios de aceite do histórico das funções avançadas", () => {
  test("√16 = 4: 1, 6, √x grava √16 = 4, com a linha acessível e o resultado no visor", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("1", "6", "√x"), "4");
    assert.deepEqual(calc.historyItems(), ["√16 = 4"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["√16 = 4"]);
    assert.deepEqual(calc.historyItemParts(0), {
      expression: "√16",
      result: "4",
      label: "√16 igual a 4, usar no visor",
    });
  });

  test("sen(30) = 0.5: 3, 0, sen grava sen(30) = 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "0", "sen"), "0.5");
    assert.deepEqual(calc.historyItems(), ["sen(30) = 0.5"]);
  });

  test("cos, tan e log gravam a própria linha: 6 0 cos, 4 5 tan e 1 0 0 0 log", () => {
    const cosCalc = createCalculator({ storage: {} });
    cosCalc.press("6", "0", "cos");
    assert.deepEqual(cosCalc.historyItems(), ["cos(60) = 0.5"]);
    const tanCalc = createCalculator({ storage: {} });
    tanCalc.press("4", "5", "tan");
    assert.deepEqual(tanCalc.historyItems(), ["tan(45) = 1"]);
    const logCalc = createCalculator({ storage: {} });
    logCalc.press("1", "0", "0", "0", "log");
    assert.deepEqual(logCalc.historyItems(), ["log(1000) = 3"]);
  });

  test("x², 1/x e x! gravam a própria linha: 9 x² grava 9² = 81, 4 1/x grava 1/4 = 0.25, 5 x! grava 5! = 120", () => {
    const squareCalc = createCalculator({ storage: {} });
    squareCalc.press("9", "x²");
    assert.deepEqual(squareCalc.historyItems(), ["9² = 81"]);
    const inverseCalc = createCalculator({ storage: {} });
    inverseCalc.press("4", "1/x");
    assert.deepEqual(inverseCalc.historyItems(), ["1/4 = 0.25"]);
    const factorialCalc = createCalculator({ storage: {} });
    factorialCalc.press("5", "x!");
    assert.deepEqual(factorialCalc.historyItems(), ["5! = 120"]);
  });

  test("cada função vira uma linha, do mais recente para o mais antigo: 1 6 √x √x grava √4 = 2 e depois √16 = 4", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("1", "6", "√x", "√x"), "2");
    assert.deepEqual(calc.historyItems(), ["√4 = 2", "√16 = 4"]);
  });

  test("função depois do igual grava a função com o resultado do igual: 2 + 3 =, √x grava √5 = 2.23606798 antes da conta", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "=", "√x");
    assert.deepEqual(calc.historyItems(), ["√5 = 2.23606798", "2 + 3 = 5"]);
  });

  test("Limpar histórico apaga também as linhas das funções: 1 6 √x, Limpar e Apagar deixam o histórico vazio e sem chave no localStorage", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("1", "6", "√x");
    calc.clickClear();
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
    assert.equal(calc.historyEmptyHidden(), false);
  });

  test("depois de limpar, função nova grava de novo: 1 6 √x, Limpar, AC, 9 √x mostra só √9 = 3", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "6", "√x");
    calc.clickClear();
    calc.press("AC", "9", "√x");
    assert.deepEqual(calc.historyItems(), ["√9 = 3"]);
  });

  test("a linha da função continua depois de recarregar a página: 1 6 √x e nova instância mostra √16 = 4", () => {
    const storage = {};
    createCalculator({ storage }).press("1", "6", "√x");
    assert.deepEqual(createCalculator({ storage }).historyItems(), ["√16 = 4"]);
  });

  test("tocar na linha da função põe o resultado no visor: 1 6 √x, AC, toque no item mostra 4", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "6", "√x", "AC");
    assert.equal(calc.tapHistoryItem(0), "4");
  });
});

describe("CALC-43: casos de borda do histórico das funções avançadas", () => {
  test("negativo fica entre parênteses no quadrado e no inverso: 3 +/- x² grava (-3)² = 9; 4 +/- 1/x grava 1/(-4) = -0.25", () => {
    const squareCalc = createCalculator({ storage: {} });
    squareCalc.press("3", "+/-", "x²");
    assert.deepEqual(squareCalc.historyItems(), ["(-3)² = 9"]);
    const inverseCalc = createCalculator({ storage: {} });
    inverseCalc.press("4", "+/-", "1/x");
    assert.deepEqual(inverseCalc.historyItems(), ["1/(-4) = -0.25"]);
  });

  test("seno de ângulo negativo não ganha parênteses extras: 3 0 +/- sen grava sen(-30) = -0.5", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("3", "0", "+/-", "sen");
    assert.deepEqual(calc.historyItems(), ["sen(-30) = -0.5"]);
  });

  test("e entra na linha com o número mostrado, e o resultado usa o valor completo: e x² grava 2.71828183² = 7.3890561", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "x²"), "7.3890561");
    assert.deepEqual(calc.historyItems(), ["2.71828183² = 7.3890561"]);
  });

  test("função com operador pendente grava a função antes do igual: 2 + 3 x² (sem =) grava só 3² = 9", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "x²");
    assert.deepEqual(calc.historyItems(), ["3² = 9"]);
  });

  test("x! acima de 2^53 grava o resultado em notação científica, como o visor: 2 0 x! grava 20! = 2.4329020081766E+18", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "0", "x!"), "2.4329020081766E+18");
    assert.deepEqual(calc.historyItems(), ["20! = 2.4329020081766E+18"]);
  });

  test("função que dá Erro não grava: √ de negativo, tan de 90°, x! de 171 e 1/x de zero não entram no histórico", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("1", "+/-", "√x"), "Erro");
    assert.equal(calc.press("AC", "9", "0", "tan"), "Erro");
    assert.equal(calc.press("AC", "1", "7", "1", "x!"), "Erro");
    assert.equal(calc.press("AC", "0", "1/x"), "Erro");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });

  test("função com Erro no visor não grava nada e não cria linha: 5 ÷ 0 =, √x mantém o Erro e o histórico fica sem a função", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "÷", "0", "=", "√x");
    assert.deepEqual(calc.historyItems(), []);
  });

  test("operação que falha depois de uma função bem-sucedida mantém a linha da função: 1 6 √x, depois 5 ÷ 0 = grava só √16 = 4", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("1", "6", "√x", "AC", "5", "÷", "0", "=");
    assert.deepEqual(calc.historyItems(), ["√16 = 4"]);
  });
});

describe("CALC-35: histórico, teclado, foco e estrutura do ln", () => {
  // ln é função aplicada ao visor: grava linha no histórico, como log (regra do CALC-43).
  test("ln grava no histórico: 1 ln grava ln(1) = 0", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("1", "ln");
    assert.deepEqual(calc.historyItems(), ["ln(1) = 0"]);
    assert.deepEqual(JSON.parse(storage[HISTORY_KEY]), ["ln(1) = 0"]);
  });

  test("ln de e grava o número mostrado e o resultado: e, ln grava ln(2.71828183) = 1", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e", "ln"), "1");
    assert.deepEqual(calc.historyItems(), ["ln(2.71828183) = 1"]);
  });

  test("ln que dá Erro não grava: 0 ln não cria linha no histórico nem chave no localStorage", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("0", "ln"), "Erro");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });

  test("Enter com o foco no ln não vira igual: o botão é que age (clique nativo), o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão ln na linha da memória (fora do teclado), logo depois do log, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="scientific">[\s\S]*?<button type="button" id="log-button"[^>]*>log<\/button>\s*<button type="button" id="ln-button" class="ln-add" data-action="ln" aria-label="Logaritmo natural \(ln\)">ln<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o ln tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.ln-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

// CALC-73: a memória e a unidade DEG/RAD ficam no armazenamento. "Recarregar" é criar outra calculadora com o mesmo objeto de storage.
const PREFERENCES_KEY = "calc-pro:preferencias";

// Armazenamento bloqueado (ex.: cookies desligados): qualquer acesso lança erro, como o localStorage faz nesse caso.
function blockedStorage() {
  const blocked = () => {
    throw new Error("armazenamento bloqueado");
  };
  return new Proxy({}, { has: blocked, get: blocked, set: blocked, deleteProperty: blocked });
}

describe("CALC-73: critérios de aceite da memória e da unidade guardadas entre sessões", () => {
  test("a memória volta ao reabrir: 5 M+, nova calculadora no mesmo storage mantém a memória em 5 e o indicador visível", () => {
    const storage = {};
    createCalculator({ storage }).press("5", "M+");
    const reopened = createCalculator({ storage });
    assert.equal(reopened.memoryValue(), 5);
    assert.equal(reopened.memoryIndicatorHidden(), false);
  });

  test("a unidade volta ao reabrir: unidade para RAD, nova calculadora no mesmo storage abre em RAD", () => {
    const storage = {};
    createCalculator({ storage }).press("unidade");
    assert.equal(createCalculator({ storage }).angleUnitLabel(), "RAD");
  });

  test("ao reabrir, o visor começa em 0 e a memória e a unidade voltam juntas: 7 M+ e unidade", () => {
    const storage = {};
    createCalculator({ storage }).press("7", "M+", "unidade");
    const reopened = createCalculator({ storage });
    assert.equal(reopened.display(), "0");
    assert.equal(reopened.memoryValue(), 7);
    assert.equal(reopened.angleUnitLabel(), "RAD");
  });

  test("M+, M- e a unidade atualizam o que está guardado: 5 M+, AC, 3 M- e unidade gravam memória 2 e RAD", () => {
    const storage = {};
    createCalculator({ storage }).press("5", "M+", "AC", "3", "M-", "unidade");
    assert.deepEqual(JSON.parse(storage[PREFERENCES_KEY]), { memory: 2, angleUnit: "rad" });
  });

  test("MC limpa também o valor guardado: 5 M+, MC grava memória 0 e a calculadora reaberta mostra memória 0 e indicador escondido", () => {
    const storage = {};
    createCalculator({ storage }).press("5", "M+", "MC");
    assert.equal(JSON.parse(storage[PREFERENCES_KEY]).memory, 0);
    const reopened = createCalculator({ storage });
    assert.equal(reopened.memoryValue(), 0);
    assert.equal(reopened.memoryIndicatorHidden(), true);
  });

  test("pelo teclado também grava: 5, m (tecla M+) e reabrir mantém a memória em 5", () => {
    const storage = {};
    createCalculator({ storage }).type("5", "m");
    assert.equal(createCalculator({ storage }).memoryValue(), 5);
  });
});

describe("CALC-73: casos de borda da memória e da unidade guardadas", () => {
  test("MC limpa o valor guardado mesmo com Erro no visor: 5 M+, 5 ÷ 0 =, MC deixa a memória guardada em 0", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    assert.equal(calc.press("5", "M+", "5", "÷", "0", "=", "MC"), "Erro");
    assert.equal(createCalculator({ storage }).memoryValue(), 0);
  });

  test("AC não apaga a memória guardada: 5 M+, AC, reabrir mantém a memória em 5", () => {
    const storage = {};
    createCalculator({ storage }).press("5", "M+", "AC");
    assert.equal(createCalculator({ storage }).memoryValue(), 5);
  });

  test("digitar e fazer contas não grava nada: 2 + 3 = não cria a chave das preferências", () => {
    const storage = {};
    createCalculator({ storage }).press("2", "+", "3", "=");
    assert.equal(PREFERENCES_KEY in storage, false);
  });

  test("sem nada salvo, a calculadora abre em DEG com memória 0", () => {
    const reopened = createCalculator({ storage: {} });
    assert.equal(reopened.angleUnitLabel(), "DEG");
    assert.equal(reopened.memoryValue(), 0);
  });

  test("armazenamento indisponível não quebra a calculadora: a conta, M+ e a unidade funcionam na sessão", () => {
    const calc = createCalculator({ storage: blockedStorage() });
    assert.equal(calc.press("2", "+", "3", "="), "5");
    assert.equal(calc.press("M+"), "5");
    assert.equal(calc.memoryValue(), 5);
    assert.equal(calc.press("unidade"), "5");
    assert.equal(calc.angleUnitLabel(), "RAD");
  });

  test("armazenamento indisponível: a calculadora abre com memória 0 e DEG, sem erro", () => {
    const calc = createCalculator({ storage: blockedStorage() });
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.angleUnitLabel(), "DEG");
  });

  test("dado salvo que não é JSON vira o padrão (memória 0, DEG), sem erro", () => {
    const storage = { [PREFERENCES_KEY]: "{não é json" };
    const calc = createCalculator({ storage });
    assert.equal(calc.memoryValue(), 0);
    assert.equal(calc.angleUnitLabel(), "DEG");
  });

  test("memória salva que não é número finito dentro do limite vira 0: texto e acima de 2^53", () => {
    const text = { [PREFERENCES_KEY]: JSON.stringify({ memory: "8", angleUnit: "deg" }) };
    assert.equal(createCalculator({ storage: text }).memoryValue(), 0);
    const huge = { [PREFERENCES_KEY]: JSON.stringify({ memory: 2 ** 53 + 2, angleUnit: "deg" }) };
    assert.equal(createCalculator({ storage: huge }).memoryValue(), 0);
  });

  test("unidade salva que não é deg nem rad vira DEG, e a memória válida é mantida", () => {
    const storage = { [PREFERENCES_KEY]: JSON.stringify({ memory: 4, angleUnit: "gradianos" }) };
    const calc = createCalculator({ storage });
    assert.equal(calc.memoryValue(), 4);
    assert.equal(calc.angleUnitLabel(), "DEG");
  });
});
