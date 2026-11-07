"use strict";

const display = document.getElementById("display");
const keypad = document.querySelector(".keypad");

const ERROR_TEXT = "Erro";

// Máximo de algarismos digitados num número (sinal, ponto e zeros à esquerda da parte inteira não contam).
const MAX_DIGITS = 9;

// Resultados são arredondados para no máximo 8 casas decimais.
const DECIMAL_PLACES = 8;

// Tamanho do display pelo número de caracteres exibidos (sinal e ponto contam).
const DISPLAY_SIZES = [
  { maxLength: 6, className: "display-64" },
  { maxLength: 8, className: "display-48" },
  { maxLength: Infinity, className: "display-40" },
];

const state = {
  current: "0",
  // Operando à esquerda aguardando o operador seguinte (ou o igual).
  previous: null,
  // Operador pendente: "add" | "subtract" | "multiply" | "divide" | null.
  operator: null,
  // true logo após apertar um operador ou o igual: o próximo dígito começa um novo número.
  waitingForOperand: false,
  // true quando a última operação falhou (divisão por zero).
  error: false,
};

const OPERATIONS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => (b === 0 ? null : a / b),
};

function displaySizeClass(text) {
  return DISPLAY_SIZES.find((size) => text.length <= size.maxLength).className;
}

function render() {
  if (display) {
    display.textContent = state.current;
    for (const size of DISPLAY_SIZES) {
      display.classList.remove(size.className);
    }
    display.classList.add(displaySizeClass(state.current));
  }
}

function reset() {
  state.current = "0";
  state.previous = null;
  state.operator = null;
  state.waitingForOperand = false;
  state.error = false;
}

function setError() {
  state.current = ERROR_TEXT;
  state.previous = null;
  state.operator = null;
  state.waitingForOperand = true;
  state.error = true;
}

// Arredonda para no máximo 8 casas decimais e remove os zeros à direita (0.1 + 0.2 → 0.3; 1 ÷ 3 → 0.33333333).
// O arredondamento também elimina o ruído de ponto flutuante. Sem notação científica.
function formatResult(value) {
  const fixed = value.toFixed(DECIMAL_PLACES).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

// Conta os algarismos digitados: sinal e ponto não contam, nem os zeros à esquerda da parte inteira.
function countDigits(entry) {
  const [integerPart, fractionPart = ""] = entry.replace("-", "").split(".");
  return integerPart.replace(/^0+/, "").length + fractionPart.length;
}

function inputDigit(digit) {
  if (state.error) {
    reset();
  }
  if (state.waitingForOperand) {
    state.current = digit;
    state.waitingForOperand = false;
    return;
  }
  // Com 9 algarismos, o próximo dígito é ignorado.
  if (countDigits(state.current) >= MAX_DIGITS) {
    return;
  }
  // O "0" inicial é substituído pelo primeiro dígito digitado.
  state.current = state.current === "0" ? digit : state.current + digit;
}

function inputDecimal() {
  if (state.error) {
    reset();
  }
  if (state.waitingForOperand) {
    state.current = "0.";
    state.waitingForOperand = false;
    return;
  }
  // Só um ponto decimal por número; um segundo ponto é ignorado.
  if (state.current.includes(".")) {
    return;
  }
  state.current += ".";
}

// +/-: inverte o sinal do número exibido. Com o zero não há sinal a inverter.
// Após erro, a tecla reinicia a calculadora.
// Depois de um operador, o número exibido vira o segundo operando (o que se vê é o que será usado).
function toggleSign() {
  if (state.error) {
    reset();
    return;
  }
  if (state.current === "0") {
    return;
  }
  state.current = state.current.startsWith("-") ? state.current.slice(1) : "-" + state.current;
  state.waitingForOperand = false;
}

// %: divide o número exibido por 100. Mesma regra de segundo operando do +/-. Após erro, reinicia.
function percent() {
  if (state.error) {
    reset();
    return;
  }
  state.current = formatResult(Number(state.current) / 100);
  state.waitingForOperand = false;
}

// Backspace (teclado): apaga o último caractere do número em edição.
// Sem número em edição (após operador ou igual) não faz nada. Após erro, reinicia a calculadora.
// Se sobrar algo que não é um número válido (ex.: "-" ou notação científica), volta para 0.
const VALID_ENTRY = /^-?\d+(\.\d*)?$/;

function deleteDigit() {
  if (state.error) {
    reset();
    return;
  }
  if (state.waitingForOperand) {
    return;
  }
  const remaining = state.current.slice(0, -1);
  state.current = VALID_ENTRY.test(remaining) ? remaining : "0";
}

// Aplica o operador pendente: left (operando à esquerda) op right.
// Retorna false se a operação falhou e o erro foi exibido.
function evaluatePending(right) {
  const result = OPERATIONS[state.operator](state.previous, right);
  if (result === null || !Number.isFinite(result)) {
    setError();
    return false;
  }
  state.current = formatResult(result);
  state.previous = Number(state.current);
  return true;
}

function inputOperator(operator) {
  if (state.error) {
    reset();
  }

  // Trocar de operador antes do segundo número substitui o anterior.
  if (state.operator !== null && state.waitingForOperand) {
    state.operator = operator;
    return;
  }

  if (state.operator !== null) {
    // Encadeamento da esquerda para a direita: resolve a operação pendente primeiro.
    if (!evaluatePending(Number(state.current))) {
      return;
    }
  } else {
    state.previous = Number(state.current);
  }

  state.operator = operator;
  state.waitingForOperand = true;
}

function inputEquals() {
  if (state.error) {
    reset();
    return;
  }
  if (state.operator === null) {
    return;
  }

  // Igual sem segundo número usa o próprio primeiro número (2 + = → 4, como no iOS).
  const right = state.waitingForOperand ? state.previous : Number(state.current);
  if (!evaluatePending(right)) {
    return;
  }

  state.operator = null;
  state.previous = null;
  state.waitingForOperand = true;
}

function handleButton(button) {
  if (button.dataset.value !== undefined) {
    const value = button.dataset.value;

    if (value === ".") {
      inputDecimal();
    } else if (/^[0-9]$/.test(value)) {
      inputDigit(value);
    } else {
      return;
    }
    return;
  }

  const action = button.dataset.action;

  if (action === "all-clear") {
    reset();
  } else if (action === "toggle-sign") {
    toggleSign();
  } else if (action === "percent") {
    percent();
  } else if (action === "equals") {
    inputEquals();
  } else if (action in OPERATIONS) {
    inputOperator(action);
  }
}

// Teclado físico: cada tecla executa a mesma ação do botão correspondente (mesmo caminho do clique).
const KEY_BUTTONS = {
  "+": { action: "add" },
  "-": { action: "subtract" },
  "*": { action: "multiply" },
  "/": { action: "divide" },
  "=": { action: "equals" },
  Enter: { action: "equals" },
  Escape: { action: "all-clear" },
  ".": { value: "." },
  ",": { value: "." },
};

// Devolve true se a tecla é uma das usadas pela calculadora.
function handleKey(key) {
  if (/^[0-9]$/.test(key)) {
    inputDigit(key);
    return true;
  }
  if (key === "Backspace") {
    deleteDigit();
    return true;
  }
  if (!(key in KEY_BUTTONS)) {
    return false;
  }
  handleButton({ dataset: KEY_BUTTONS[key] });
  return true;
}

if (keypad) {
  keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !keypad.contains(button)) {
      return;
    }

    handleButton(button);
    render();
  });
}

document.addEventListener("keydown", (event) => {
  // Atalhos do navegador (Ctrl+C, Cmd+R etc.) continuam funcionando.
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (!handleKey(event.key)) {
    return;
  }

  // Impede que Enter, com um botão da calculadora focado, dispare também o clique desse botão.
  event.preventDefault();
  render();
});

render();
