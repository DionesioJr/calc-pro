"use strict";

// Interface: desenha o visor e os indicadores a partir do estado, e controla o painel do histórico no mobile.
// Tamanho do display pelo número de caracteres exibidos (sinal e ponto contam).
const DISPLAY_SIZES = [
  { maxLength: 6, className: "display-64" },
  { maxLength: 8, className: "display-48" },
  { maxLength: Infinity, className: "display-40" },
];

// Ids das ações binárias (+, −, ×, ÷, xʸ), tiradas do registro ACTIONS: dizem só quais botões são operadores, não fazem conta.
const BINARY_ACTION_IDS = new Set(ACTIONS.filter((action) => action.type === "binary").map((action) => action.id));

let display = null;
let calculatorElement = null;
let historyOpen = null;
let historyPanel = null;
let historyClose = null;
let memoryIndicator = null;
let parenIndicator = null;
let parenSymbols = null;
let parenText = null;
// Botões de operador (destacados enquanto a operação espera o segundo número).
let operatorButtons = [];

// Liga a interface ao documento: visor, indicadores, botões de operador e o painel do histórico (abrir, fechar, desktop).
function bindUi(doc, win) {
  display = doc.getElementById("display");
  calculatorElement = doc.getElementById("calculator");
  historyOpen = doc.getElementById("history-open");
  historyPanel = doc.getElementById("history-panel");
  historyClose = doc.getElementById("history-close");
  memoryIndicator = doc.getElementById("memory-indicator");
  parenIndicator = doc.getElementById("paren-indicator");
  parenSymbols = doc.getElementById("paren-symbols");
  parenText = doc.getElementById("paren-text");

  // Botões do teclado numérico, mais o xʸ (que fica fora do teclado): operadores binários com destaque pendente.
  const keypad = doc.querySelector(".keypad");
  const buttons = keypad ? Array.from(keypad.querySelectorAll("button")) : [];
  operatorButtons = buttons.filter((button) => BINARY_ACTION_IDS.has(button.dataset.action));
  const powerButton = doc.getElementById("power-button");
  if (powerButton) {
    operatorButtons.push(powerButton);
  }

  // Mobile: o histórico vira painel em tela cheia, aberto pelo botão Histórico e fechado pelo × ou por Escape.
  if (historyOpen) {
    historyOpen.addEventListener("click", showHistoryPanel);
  }
  if (historyClose) {
    historyClose.addEventListener("click", hideHistoryPanel);
  }

  // Ao passar para o desktop, o histórico volta a ser coluna ao lado: se o painel estava aberto, fecha para
  // não deixar a calculadora inerte.
  if (win && typeof win.matchMedia === "function") {
    const desktopQuery = win.matchMedia("(min-width: 768px)");
    if (desktopQuery && typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", (event) => {
        if (event.matches) {
          hideHistoryPanel();
        }
      });
    }
  }
}

// Classe de tamanho de fonte do visor, pelo número de caracteres do texto.
function displaySizeClass(text) {
  return DISPLAY_SIZES.find((size) => text.length <= size.maxLength).className;
}

// Desenha o visor e os indicadores a partir do estado recebido (quem chama guarda o estado).
function render(state) {
  if (display) {
    display.textContent = state.current;
    for (const size of DISPLAY_SIZES) {
      display.classList.remove(size.className);
    }
    display.classList.add(displaySizeClass(state.current));
  }

  // Operador destacado (aria-pressed="true", estilizado no CSS): só enquanto o segundo número não começou.
  const selectedOperator = state.waitingForOperand ? trailingOperator(state) : null;
  for (const button of operatorButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.action === selectedOperator));
  }

  // Indicador de memória: visível só enquanto houver valor guardado.
  if (memoryIndicator) {
    memoryIndicator.hidden = state.memory === 0;
  }

  // Indicador de parênteses: visível só com grupo aberto. Os "(" aparecem no visor da linha e o texto vai para o leitor de tela.
  if (parenIndicator) {
    const depth = openDepth(state);
    parenIndicator.hidden = depth === 0;
    if (parenSymbols) {
      parenSymbols.textContent = OPEN_PAREN.repeat(depth);
    }
    if (parenText) {
      parenText.textContent = depth === 1 ? "1 parêntese aberto" : `${depth} parênteses abertos`;
    }
  }
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
  if (calculatorElement) {
    calculatorElement.inert = true;
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
  if (calculatorElement) {
    calculatorElement.inert = false;
  }
  if (historyOpen) {
    historyOpen.setAttribute("aria-expanded", "false");
    historyOpen.focus();
  }
}
