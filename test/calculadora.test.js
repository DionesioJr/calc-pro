"use strict";

// Testes da entrada de dígitos e ponto decimal (CALC-4), da lógica de operações (CALC-5),
// de AC/+/-/% (CALC-6), do teclado físico (CALC-8), de erro, limite de dígitos,
// arredondamento e tamanho da fonte (CALC-7), do feedback visual dos botões (CALC-9),
// do limite de 2^53 para resultados (CALC-16), do histórico de cálculos no localStorage (CALC-19),
// do painel de histórico reformulado (CALC-20: itens tocáveis, confirmação ao limpar),
// e do layout mobile com o painel do histórico em tela cheia (CALC-21),
// e do botão M+ com o indicador de memória (CALC-22),
// e do botão x² (CALC-26: eleva o visor ao quadrado, com erro e formatação do visor),
// e do botão sen (CALC-31: seno do visor em graus, com a unidade DEG visível),
// e do botão π (CALC-36: insere pi como operando),
// e do botão e (CALC-37: insere o número de Euler como operando),
// e do botão 1/x (CALC-38: inverso do visor, com Erro para zero),
// e do botão M- (CALC-23: subtrai o visor da memória),
// e do botão MR (CALC-24: copia a memória para o visor como operando),
// e do botão MC (CALC-25: zera a memória e o indicador).
// Executa script.js real num contexto isolado, com um DOM mínimo, e aperta
// os botões pelo mesmo caminho de clique que o navegador usa; o teclado usa o mesmo
// caminho de keydown.
// Sem dependências: rodar com `npm test` (node --test, Node 18+).

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const SCRIPT_SOURCE = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const CSS_SOURCE = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");

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
  "+/-": { action: "toggle-sign" },
  "%": { action: "percent" },
  "+": { action: "add" },
  "−": { action: "subtract" },
  "×": { action: "multiply" },
  "÷": { action: "divide" },
  "=": { action: "equals" },
};

// classList mínimo, com o que o script.js usa (add, remove, contains).
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
  buttonByKey["sen"] = sineElement;
  buttonByKey["π"] = piElement;
  buttonByKey["e"] = eElement;
  buttonByKey["1/x"] = inverseElement;

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
    "sine-button": sineElement,
    "pi-button": piElement,
    "e-button": eElement,
    "inverse-button": inverseElement,
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
  // Contexto com o script carregado: depois de rodar, o estado do script (const state) fica lido por runInContext.
  const context = vm.createContext({ document, window, localStorage });
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "script.js" });

  // Aperta as teclas em sequência e devolve o texto final do display. MC, MR, M+, M-, x², sen, π, e e 1/x são clicados pelo próprio botão, fora do teclado.
  function press(...keys) {
    for (const key of keys) {
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
      const button = buttonByKey[key];
      onKeypadClick({ target: { closest: () => button } });
    }
    return display.textContent;
  }

  // Valor guardado na memória (registrador do script), lido do mesmo contexto.
  function memoryValue() {
    return vm.runInContext("state.memory", context);
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

  test("% depois do operador vira o segundo operando: 5, +, %, = resulta em 5.05", () => {
    const calc = createCalculator();
    assert.equal(calc.press("5", "+", "%", "="), "5.05");
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

  test("Backspace após erro reinicia a calculadora: 5, ÷, 0, =, Backspace resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.type("5", "/", "0", "=", "Backspace"), "0");
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

  test("Backspace não tem botão e não marca nenhum: 7, Backspace baixado não escurece botão algum e apaga o 7", () => {
    const calc = createCalculator();
    calc.press("7");
    assert.equal(calc.keyDown("Backspace", { code: "Backspace" }).key, "Backspace");
    for (const key of Object.keys(KEY_DATASET)) {
      assert.equal(calc.buttonFor(key).classList.contains("is-pressed"), false, `botão ${key}`);
    }
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

// Chave do localStorage do histórico (ver HISTORY_KEY em script.js).
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

  test("encadeamento grava a expressão inteira: 2 + 3 × 4 = grava 2 + 3 × 4 = 20", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("2", "+", "3", "×", "4", "="), "20");
    assert.deepEqual(calc.historyItems(), ["2 + 3 × 4 = 20"]);
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

  test("percentual como segundo operando grava o valor usado: 5 + % = grava 5 + 0.05 = 5.05", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("5", "+", "%", "="), "5.05");
    assert.deepEqual(calc.historyItems(), ["5 + 0.05 = 5.05"]);
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
    const [base, desktop] = CSS_SOURCE.split("@media (min-width: 768px)");
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
    const desktop = CSS_SOURCE.split("@media (min-width: 768px)")[1];
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

// Regras do mobile: o bloco @media (max-width: 767px) fica no fim do style.css.
const MOBILE_CSS = (CSS_SOURCE.match(/@media \(max-width: 767px\) \{[\s\S]*$/) || [""])[0];

// Lado do botão no mobile, como o style.css calcula em --cell: o menor entre a largura (4 colunas) e a altura
// (5 linhas, com o visor com pelo menos --display-min). Em px, com 1rem = 16px: --pad 16, --gap 12, --display-min 72.
function mobileButtonSide(width, height) {
  const pad = 16;
  const gap = 12;
  const displayMin = 72;
  const byWidth = (width - 2 * pad - 3 * gap) / 4;
  const byHeight = (height - 2 * pad - 4 * gap - displayMin) / 5;
  return Math.min(byWidth, byHeight);
}

describe("CALC-21: critérios de aceite do layout mobile", () => {
  test("no mobile a calculadora ocupa a viewport inteira: fundo preto na página, 100% de largura e altura, sem cantos", () => {
    assert.ok(MOBILE_CSS.length > 0, "precisa existir um bloco @media (max-width: 767px)");
    assert.match(MOBILE_CSS, /body\s*\{[^}]*background:\s*#000000;[^}]*\}/);
    assert.match(MOBILE_CSS, /\.layout\s*\{[^}]*height:\s*100dvh;[^}]*\}/);
    assert.match(MOBILE_CSS, /\.calculator\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*border-radius:\s*0;[^}]*\}/);
  });

  test("botões são quadrados do mesmo lado (--cell) e o 0 ocupa duas colunas", () => {
    assert.match(MOBILE_CSS, /\.keypad\s*\{[^}]*--cell:\s*min\(/);
    assert.match(MOBILE_CSS, /\.keypad\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*var\(--cell\)\);[^}]*\}/);
    assert.match(MOBILE_CSS, /\.keypad\s*\{[^}]*grid-auto-rows:\s*var\(--cell\);[^}]*\}/);
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
      const keypadHeight = 5 * side + 4 * 12;
      assert.ok(side >= 44, `${width}x${height}: botão de ${side}px`);
      assert.ok(2 * 16 + keypadHeight + 72 <= height, `${width}x${height}: teclado não cabe na altura`);
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
    assert.match(CSS_SOURCE, /\.memory-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });

  test("no mobile a linha da memória não encolhe com o visor: .memory com flex: none", () => {
    assert.match(MOBILE_CSS, /\.memory\s*\{\s*flex:\s*none;\s*\}/);
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

  test("x² não grava no histórico sozinho: 9 x² não cria item nem chave no localStorage", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("9", "x²");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
  });

  test("o cálculo usa o valor elevado no histórico: 2 + 3 x², = grava 2 + 9 = 11", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3", "x²", "=");
    assert.deepEqual(calc.historyItems(), ["2 + 9 = 11"]);
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
      /<div class="memory">[\s\S]*?<button type="button" id="square-button" class="square-add" data-action="square" aria-label="Elevar ao quadrado \(x²\)">x²<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o x² tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.square-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-31: critérios de aceite do seno (sen, em graus)", () => {
  test("sen(30°) = 0.5: 3, 0, sen resulta em 0.5", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("3", "0", "sen"), "0.5");
  });

  test("a unidade angular fica visível o tempo todo: DEG aparece no HTML sem o atributo hidden", () => {
    assert.match(HTML_SOURCE, /<span id="angle-unit" class="angle-unit"><span aria-hidden="true">DEG<\/span>/);
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
    assert.deepEqual(calc.historyItems(), ["2 + 0.5 = 2.5"]);
  });

  test("sen não grava no histórico sozinho e não mexe na memória: 5 M+, AC, 3 0 sen mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "3", "0", "sen");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
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
      /<div class="memory">[\s\S]*?<button type="button" id="sine-button" class="sine-add" data-action="sine" aria-label="Seno em graus \(sen\)">sen<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o sen tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.sine-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
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
  test("π não tem tecla própria: Enter com o foco no botão π não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão π na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="memory">[\s\S]*?<button type="button" id="pi-button" class="pi-add" data-action="pi" aria-label="Inserir pi \(π\)">π<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o π tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.pi-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});

describe("CALC-37: critérios de aceite do e (número de Euler)", () => {
  test("e mostra 2.71828183 (8 casas, como os resultados): e resulta em 2.71828183", () => {
    const calc = createCalculator({ storage: {} });
    assert.equal(calc.press("e"), "2.71828183");
  });

  // xʸ (CALC-29) ainda não existe nesta calculadora; e² sai de e seguido de x², que é o mesmo cálculo.
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
  test("e não tem tecla própria: Enter com o foco no botão e não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão e na linha da memória (fora do teclado), com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="memory">[\s\S]*?<button type="button" id="e-button" class="e-add" data-action="euler" aria-label="Inserir número de Euler \(e\)">e<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o e tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.e-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
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
    assert.deepEqual(calc.historyItems(), ["2 + 0.25 = 2.25"]);
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

  test("1/x não grava no histórico sozinho e não mexe na memória: 5 M+, AC, 4 1/x mantém a memória em 5", () => {
    const storage = {};
    const calc = createCalculator({ storage });
    calc.press("5", "M+", "AC", "4", "1/x");
    assert.deepEqual(calc.historyItems(), []);
    assert.equal(HISTORY_KEY in storage, false);
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
      /<div class="memory">[\s\S]*?<button type="button" id="inverse-button" class="inverse-add" data-action="inverse" aria-label="Inverso \(1\/x\)">1\/x<\/button>[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o 1/x tem foco visível com contorno branco, sem remover o outline", () => {
    assert.match(CSS_SOURCE, /\.inverse-add:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
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
  test("não há tecla de M- no teclado físico: a tecla - segue como subtração, e a memória não muda: 5, M+, AC, 8, -, 3, = resulta em 5", () => {
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
      /<div class="memory">\s*(?:<button type="button" id="memory-clear"[^>]*>MC<\/button>\s*)?<button type="button" id="memory-recall"[^>]*>MR<\/button>\s*<button type="button" id="memory-add"[^>]*>M\+<\/button>\s*<button type="button" id="memory-subtract" class="memory-subtract" data-action="memory-subtract" aria-label="Subtrair da memória \(M-\)">M-<\/button>\s*<button type="button" id="square-button"[\s\S]*?<\/div>\s*<div class="keypad">/,
    );
  });

  test("o M- tem o mesmo estilo de pílula cinza do M+ e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.memory-subtract\s*\{[^}]*border-radius:\s*999px;[^}]*color:\s*#a5a5a5;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.memory-subtract:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });

  test("a linha da memória quebra linha em vez de estourar a largura com seis botões: .memory com flex-wrap: wrap", () => {
    assert.match(CSS_SOURCE, /\.memory\s*\{[^}]*flex-wrap:\s*wrap;[^}]*\}/);
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
  test("MR não tem tecla própria: Enter com o foco no MR não vira igual, o cálculo em curso fica", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("2", "+", "3");
    const event = calc.keyDown("Enter", { target: { tagName: "BUTTON" } });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.display(), "3");
  });

  test("index.html tem o botão MR antes do M+, na linha da memória, fora do teclado, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="memory">\s*(?:<button type="button" id="memory-clear"[^>]*>MC<\/button>\s*)?<button type="button" id="memory-recall" class="memory-recall" data-action="memory-recall" aria-label="Recuperar memória \(MR\)">MR<\/button>\s*<button type="button" id="memory-add"/,
    );
  });

  test("o MR tem o mesmo estilo de pílula cinza do M+ e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.memory-recall\s*\{[^}]*border-radius:\s*999px;[^}]*color:\s*#a5a5a5;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.memory-recall:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
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
  test("MC não tem tecla própria: a tecla c não zera a memória", () => {
    const calc = createCalculator({ storage: {} });
    calc.press("5", "M+", "AC");
    calc.type("c");
    assert.equal(calc.memoryValue(), 5);
    assert.equal(calc.memoryIndicatorHidden(), false);
  });

  test("index.html tem o botão MC antes do MR, na linha da memória, fora do teclado, com rótulo que anuncia a operação", () => {
    assert.match(
      HTML_SOURCE,
      /<div class="memory">\s*<button type="button" id="memory-clear" class="memory-clear" data-action="memory-clear" aria-label="Limpar memória \(MC\)">MC<\/button>\s*<button type="button" id="memory-recall"/,
    );
  });

  test("o MC tem o mesmo estilo de pílula cinza do MR e foco visível com contorno branco", () => {
    assert.match(CSS_SOURCE, /\.memory-clear\s*\{[^}]*border-radius:\s*999px;[^}]*color:\s*#a5a5a5;[^}]*\}/);
    assert.match(CSS_SOURCE, /\.memory-clear:focus-visible\s*\{\s*outline:\s*3px solid #ffffff;/);
  });
});
