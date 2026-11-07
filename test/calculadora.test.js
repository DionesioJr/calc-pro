"use strict";

// Testes da entrada de dígitos e ponto decimal (CALC-4), da lógica de operações (CALC-5),
// de AC/+/-/% (CALC-6), do teclado físico (CALC-8), de erro, limite de dígitos,
// arredondamento e tamanho da fonte (CALC-7), do feedback visual dos botões (CALC-9),
// e do limite de 2^53 para resultados (CALC-16).
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

function createCalculator() {
  const display = { textContent: "", classList: createClassList() };
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

  const keypad = {
    addEventListener(type, listener) {
      if (type === "click") {
        onKeypadClick = listener;
      }
    },
    querySelectorAll: (selector) => (selector === "button" ? buttons : []),
    contains: () => true,
  };

  const document = {
    getElementById: (id) => (id === "display" ? display : null),
    querySelector: (selector) => (selector === ".keypad" ? keypad : null),
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

  vm.runInNewContext(SCRIPT_SOURCE, { document, window }, { filename: "script.js" });

  // Aperta as teclas em sequência e devolve o texto final do display.
  function press(...keys) {
    for (const key of keys) {
      const button = buttonByKey[key];
      onKeypadClick({ target: { closest: () => button } });
    }
    return display.textContent;
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

  return { press, keyDown, keyUp, blur, type, fontSizeClass, buttonFor, selectedOperator };
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

  test("operadores pelo teclado: 7 + 2 resulta em 9, 7 - 2 resulta em 5, 7 * 2 resulta em 14, 8 / 2 resulta em 4", () => {
    assert.equal(createCalculator().type("7", "+", "2", "="), "9");
    assert.equal(createCalculator().type("7", "-", "2", "="), "5");
    assert.equal(createCalculator().type("7", "*", "2", "="), "14");
    assert.equal(createCalculator().type("8", "/", "2", "="), "4");
  });

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

  test("resultado pequeno arredondado a 8 casas não vira notação científica: 0.00000015 seguido de % resulta em 0", () => {
    const calc = createCalculator();
    assert.equal(calc.press("0", ".", "0", "0", "0", "0", "0", "0", "1", "5", "%"), "0");
    assert.equal(calc.type("Backspace"), "0");
  });

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

  test("atalhos com Ctrl, Cmd ou Alt são deixados para o navegador: Ctrl+7 e Ctrl+Backspace não mexem no display", () => {
    const calc = createCalculator();
    calc.press("4");
    const event = calc.keyDown("7", { ctrlKey: true });
    assert.equal(event.defaultPrevented, false);
    assert.equal(calc.keyDown("Backspace", { metaKey: true }).defaultPrevented, false);
    assert.equal(calc.keyDown("Escape", { altKey: true }).defaultPrevented, false);
    assert.equal(calc.type(), "4");
  });
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
