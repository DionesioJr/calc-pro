"use strict";

const display = document.getElementById("display");
const keypad = document.querySelector(".keypad");

const ERROR_TEXT = "Erro";

// Máximo de algarismos digitados num número (sinal, ponto e zeros à esquerda da parte inteira não contam).
const MAX_DIGITS = 9;

// Resultados são arredondados para no máximo 8 casas decimais.
const DECIMAL_PLACES = 8;

// Resultado com valor absoluto acima de 2^53 não é exato em double (ex.: 999999999 × 999999999 perderia algarismos): mostra Erro.
const MAX_RESULT = 2 ** 53;

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
  // Partes da expressão em curso (ex.: ["12", "×", "3", "="]); viram uma linha do histórico no igual.
  expression: [],
  // Registrador da memória (M+): soma dos valores do visor. Começa em 0; AC não o apaga.
  memory: 0,
};

const OPERATIONS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => (b === 0 ? null : a / b),
};

const OPERATOR_SYMBOLS = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
};

// Histórico de cálculos, no localStorage; do mais antigo para o mais recente.
const HISTORY_KEY = "calc-pro:historico";
const calculationHistory = loadHistory();
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const historyActions = document.getElementById("history-actions");
const historyClear = document.getElementById("history-clear");
const historyConfirm = document.getElementById("history-confirm");
const historyCancel = document.getElementById("history-cancel");
const historyConfirmYes = document.getElementById("history-confirm-yes");

// Mobile: o histórico vira painel em tela cheia, aberto pelo botão Histórico e fechado pelo × ou por Escape.
const calculator = document.getElementById("calculator");
const historyOpen = document.getElementById("history-open");
const historyPanel = document.getElementById("history-panel");
const historyClose = document.getElementById("history-close");

// Botões do teclado numérico: o destaque do operador e o efeito de tecla pressionada usam esta lista.
const buttons = keypad ? Array.from(keypad.querySelectorAll("button")) : [];
const operatorButtons = buttons.filter((button) => Object.hasOwn(OPERATIONS, button.dataset.action));

// Botão M+ fica fora do teclado numérico, mas recebe as mesmas teclas e o efeito de tecla pressionada.
const memoryAddButton = document.getElementById("memory-add");
const memoryIndicator = document.getElementById("memory-indicator");

// Botão x² fica na mesma linha do M+, fora do teclado numérico (que segue com 5 linhas).
const squareButton = document.getElementById("square-button");
// Botão sen também fica nessa linha, pelo mesmo motivo.
const sineButton = document.getElementById("sine-button");
// Botão π também fica nessa linha, pelo mesmo motivo.
const piButton = document.getElementById("pi-button");
const pressableButtons = memoryAddButton ? [...buttons, memoryAddButton] : buttons;

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

  // Operador destacado (aria-pressed="true", estilizado no CSS): só enquanto o segundo número não começou.
  const selectedOperator = state.operator !== null && state.waitingForOperand ? state.operator : null;
  for (const button of operatorButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.action === selectedOperator));
  }

  // Indicador de memória: visível só enquanto houver valor guardado.
  if (memoryIndicator) {
    memoryIndicator.hidden = state.memory === 0;
  }
}

// Reinicia o cálculo em curso. O histórico não é apagado aqui (só pelo botão Limpar histórico).
function reset() {
  state.current = "0";
  state.previous = null;
  state.operator = null;
  state.waitingForOperand = false;
  state.error = false;
  state.expression = [];
}

function setError() {
  state.current = ERROR_TEXT;
  state.previous = null;
  state.operator = null;
  state.waitingForOperand = true;
  state.error = true;
  state.expression = [];
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
    // Só entram textos no formato "expressão = resultado"; o resto é descartado.
    return Array.isArray(saved) ? saved.filter((item) => typeof item === "string" && item.includes(" = ")) : [];
  } catch {
    // Dado corrompido ou armazenamento indisponível: começa com histórico vazio.
    return [];
  }
}

function saveHistory() {
  try {
    if (calculationHistory.length === 0) {
      localStorage.removeItem(HISTORY_KEY);
    } else {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(calculationHistory));
    }
  } catch {
    // Sem armazenamento (ex.: modo privado com cota cheia): o histórico vale só até fechar a página.
  }
}

// Divide "12 × 3 = 36" em expressão e resultado (o resultado vem depois do último " = ").
function splitCalculation(text) {
  const index = text.lastIndexOf(" = ");
  return { expression: text.slice(0, index), result: text.slice(index + 3) };
}

// Clique ou toque num item: o resultado vai para o visor, e o próximo dígito começa um número novo.
function recallResult(result) {
  reset();
  state.current = result;
  state.waitingForOperand = true;
  render();
}

// Painel do histórico (mobile). Enquanto aberto, a calculadora fica inerte: foco e toque não chegam aos botões.
function isHistoryPanelShown() {
  return historyPanel !== null && historyPanel.classList.contains("is-open");
}

function showHistoryPanel() {
  if (!historyPanel) {
    return;
  }
  historyPanel.classList.add("is-open");
  if (calculator) {
    calculator.inert = true;
  }
  if (historyOpen) {
    historyOpen.setAttribute("aria-expanded", "true");
  }
  if (historyClose) {
    historyClose.focus();
  }
}

// Fecha o painel e devolve o foco ao botão Histórico, de onde o usuário veio.
function hideHistoryPanel() {
  if (!historyPanel || !isHistoryPanelShown()) {
    return;
  }
  historyPanel.classList.remove("is-open");
  if (calculator) {
    calculator.inert = false;
  }
  if (historyOpen) {
    historyOpen.setAttribute("aria-expanded", "false");
    historyOpen.focus();
  }
}

// Mais recente primeiro. Cada item é um botão (alcançável pelo teclado); texto vai por textContent, nunca como HTML.
function renderHistory() {
  if (!historyList || !historyEmpty) {
    return;
  }
  const items = calculationHistory.slice().reverse().map((text) => {
    const { expression, result } = splitCalculation(text);

    const expressionText = document.createElement("span");
    expressionText.className = "history-expression";
    expressionText.textContent = expression;

    const resultText = document.createElement("span");
    resultText.className = "history-result";
    resultText.textContent = result;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.setAttribute("aria-label", `${expression} igual a ${result}, usar no visor`);
    button.replaceChildren(expressionText, resultText);
    // No mobile, o painel cobre o visor: ao usar um item, o painel fecha para o resultado aparecer.
    button.addEventListener("click", () => {
      recallResult(result);
      hideHistoryPanel();
    });

    const item = document.createElement("li");
    item.replaceChildren(button);
    return item;
  });
  historyList.replaceChildren(...items);
  historyList.hidden = items.length === 0;
  historyEmpty.hidden = items.length > 0;
  // Sem cálculos, o botão Limpar some: o painel mostra só a mensagem de vazio.
  if (historyActions) {
    historyActions.hidden = items.length === 0;
  }
}

function addCalculation(text) {
  calculationHistory.push(text);
  saveHistory();
  renderHistory();
}

// Limpar pede confirmação: o botão dá lugar a "Apagar todo o histórico?" com Cancelar (foco inicial) e Apagar.
function showClearConfirm() {
  if (!historyClear || !historyConfirm || !historyCancel) {
    return;
  }
  historyClear.hidden = true;
  historyConfirm.hidden = false;
  historyCancel.focus();
}

function hideClearConfirm() {
  if (!historyClear || !historyConfirm) {
    return;
  }
  historyConfirm.hidden = true;
  historyClear.hidden = false;
}

function clearHistory() {
  calculationHistory.length = 0;
  saveHistory();
  hideClearConfirm();
  renderHistory();
  if (historyEmpty) {
    historyEmpty.focus();
  }
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

// M+: soma o número exibido à memória (o visor não muda). Com Erro no visor não faz nada.
// Se a soma passar de 2^53, mostra Erro, como qualquer resultado, e a memória fica como estava.
function memoryAdd() {
  if (state.error) {
    return;
  }
  const sum = state.memory + Number(state.current);
  if (!Number.isFinite(sum) || Math.abs(sum) > MAX_RESULT) {
    setError();
    return;
  }
  state.memory = Number(formatResult(sum));
}

// x²: eleva o número exibido ao quadrado, com a mesma regra de segundo operando do % (o visor mostra o resultado).
// Com Erro no visor não calcula e mantém o Erro. Se o quadrado passar de 2^53 em valor absoluto, mostra Erro.
function square() {
  if (state.error) {
    return;
  }
  const result = Number(state.current) ** 2;
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError();
    return;
  }
  state.current = formatResult(result);
  state.waitingForOperand = false;
}

// Seno em graus (o visor mostra DEG). Múltiplos de 90° saem exatos (sen 0° = 0, sen 90° = 1); os demais usam radianos.
// Reduzir módulo 360 antes evita perder precisão com ângulos grandes.
const EXACT_SINES = [0, 1, 0, -1];

function sineDegrees(degrees) {
  const angle = ((degrees % 360) + 360) % 360;
  if (angle % 90 === 0) {
    return EXACT_SINES[angle / 90];
  }
  return Math.sin((angle * Math.PI) / 180);
}

// sen: troca o número exibido pelo seno dele, com a mesma regra de segundo operando do % e do x².
// Com Erro no visor não calcula e mantém o Erro. O seno fica entre -1 e 1, então não há limite de 2^53 a checar.
function sine() {
  if (state.error) {
    return;
  }
  state.current = formatResult(sineDegrees(Number(state.current)));
  state.waitingForOperand = false;
}

// π: insere pi (3.14159265, com as 8 casas de qualquer resultado) como operando, substituindo o número em curso,
// como o sen. Após Erro, começa uma calculadora nova, como um dígito.
// O cálculo usa o valor completo; o visor mostra o que couber.
function insertPi() {
  if (state.error) {
    reset();
  }
  state.current = formatResult(Math.PI);
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
// Retorna false se a operação falhou (divisão por zero, resultado não finito ou acima de 2^53) e o erro foi exibido.
function evaluatePending(right) {
  const result = OPERATIONS[state.operator](state.previous, right);
  if (result === null || !Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
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

  // Trocar de operador antes do segundo número substitui o anterior (também na expressão).
  if (state.operator !== null && state.waitingForOperand) {
    state.operator = operator;
    state.expression[state.expression.length - 1] = OPERATOR_SYMBOLS[operator];
    return;
  }

  // Número que está sendo fechado agora: o primeiro operando, ou o segundo em um encadeamento.
  const operand = state.current;

  if (state.operator !== null) {
    // Encadeamento da esquerda para a direita: resolve a operação pendente primeiro.
    if (!evaluatePending(Number(state.current))) {
      return;
    }
  } else {
    state.previous = Number(state.current);
  }

  state.expression.push(operand, OPERATOR_SYMBOLS[operator]);
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
  const rightOperand = state.waitingForOperand ? formatResult(state.previous) : state.current;
  if (!evaluatePending(right)) {
    return;
  }

  state.expression.push(rightOperand, "=", state.current);
  addCalculation(state.expression.join(" "));
  state.expression = [];

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
  } else if (action === "memory-add") {
    memoryAdd();
  } else if (action === "square") {
    square();
  } else if (action === "sine") {
    sine();
  } else if (action === "pi") {
    insertPi();
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
  // M+ pelo teclado: m ou M (com ou sem Shift).
  m: { action: "memory-add" },
  M: { action: "memory-add" },
};

// Tecla → dataset no mesmo formato de data-value/data-action; null se a tecla não tem botão (ex.: Backspace).
function datasetForKey(key) {
  if (/^[0-9]$/.test(key)) {
    return { value: key };
  }
  return Object.hasOwn(KEY_BUTTONS, key) ? KEY_BUTTONS[key] : null;
}

// Botão do teclado correspondente a um dataset (ex.: { value: "7" } ou { action: "add" }), ou null.
function findButton(dataset) {
  const attribute = dataset.value !== undefined ? "value" : "action";
  return pressableButtons.find((button) => button.dataset[attribute] === dataset[attribute]) ?? null;
}

// Tecla física pressionada: o botão correspondente escurece até a tecla ser solta, ou até a janela perder o foco.
// Indexado pelo código físico (event.code), para que soltar a tecla com outro caractere (ex.: Shift) ainda a libere.
const heldKeys = new Map();

function holdKey(code, button) {
  if (button === null) {
    return;
  }
  button.classList.add("is-pressed");
  heldKeys.set(code, button);
}

function releaseKey(code) {
  const button = heldKeys.get(code);
  if (button !== undefined) {
    button.classList.remove("is-pressed");
    heldKeys.delete(code);
  }
}

function releaseAllKeys() {
  Array.from(heldKeys.keys()).forEach((code) => releaseKey(code));
}

// Devolve true se a tecla é uma das usadas pela calculadora.
function handleKey(key) {
  if (key === "Backspace") {
    deleteDigit();
    return true;
  }
  const dataset = datasetForKey(key);
  if (dataset === null) {
    return false;
  }
  handleButton({ dataset });
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

if (memoryAddButton) {
  memoryAddButton.addEventListener("click", () => {
    handleButton(memoryAddButton);
    render();
  });
}

if (squareButton) {
  squareButton.addEventListener("click", () => {
    handleButton(squareButton);
    render();
  });
}

if (sineButton) {
  sineButton.addEventListener("click", () => {
    handleButton(sineButton);
    render();
  });
}

if (piButton) {
  piButton.addEventListener("click", () => {
    handleButton(piButton);
    render();
  });
}

if (historyClear) {
  historyClear.addEventListener("click", showClearConfirm);
}

if (historyCancel) {
  historyCancel.addEventListener("click", () => {
    hideClearConfirm();
    if (historyClear) {
      historyClear.focus();
    }
  });
}

if (historyConfirmYes) {
  historyConfirmYes.addEventListener("click", clearHistory);
}

if (historyOpen) {
  historyOpen.addEventListener("click", showHistoryPanel);
}

if (historyClose) {
  historyClose.addEventListener("click", hideHistoryPanel);
}

document.addEventListener("keydown", (event) => {
  // Atalhos do navegador (Ctrl+C, Cmd+R etc.) continuam funcionando.
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  // Painel aberto (mobile): Escape fecha o painel sem limpar o visor; as outras teclas não chegam à calculadora.
  if (isHistoryPanelShown()) {
    if (event.key === "Escape") {
      event.preventDefault();
      hideHistoryPanel();
    }
    return;
  }
  // Enter com o foco num botão fora do teclado (ex.: Limpar histórico) aciona esse botão, não o igual.
  if (
    event.key === "Enter" &&
    event.target &&
    event.target.tagName === "BUTTON" &&
    keypad &&
    !keypad.contains(event.target)
  ) {
    return;
  }
  if (!handleKey(event.key)) {
    return;
  }

  const dataset = datasetForKey(event.key);
  if (dataset !== null) {
    holdKey(event.code || event.key, findButton(dataset));
  }

  // Impede que Enter, com um botão da calculadora focado, dispare também o clique desse botão.
  event.preventDefault();
  render();
});

document.addEventListener("keyup", (event) => {
  releaseKey(event.code || event.key);
});

// Sem essa liberação, uma tecla solta com a janela fora de foco deixaria o botão escurecido.
if (typeof window !== "undefined") {
  window.addEventListener("blur", releaseAllKeys);
}

// Ao passar para o desktop, o histórico volta a ser coluna ao lado: se o painel estava aberto, fecha para
// não deixar a calculadora inerte.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const desktopQuery = window.matchMedia("(min-width: 768px)");
  if (desktopQuery && typeof desktopQuery.addEventListener === "function") {
    desktopQuery.addEventListener("change", (event) => {
      if (event.matches) {
        hideHistoryPanel();
      }
    });
  }
}

render();
renderHistory();
