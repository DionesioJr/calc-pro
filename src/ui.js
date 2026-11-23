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
// Linha da expressão em andamento, acima do visor (CALC-23), e o documento dela, para criar os spans dos operadores.
let expressionElement = null;
let expressionDocument = null;
let calculatorElement = null;
let historyOpen = null;
let historyPanel = null;
let historyClose = null;
let memoryIndicator = null;
let parenIndicator = null;
let parenSymbols = null;
let parenText = null;
let angleUnitButton = null;
// Tecla 2nd (CALC-69) e os botões que têm função secundária: rótulo e nome acessível trocam enquanto a 2nd estiver ativa.
let secondaryToggle = null;
let secondaryButtons = [];
// Texto visível e nome do botão DEG/RAD: o rótulo acessível diz a unidade atual e a próxima.
const ANGLE_UNITS = {
  deg: { label: "DEG", name: "graus", next: "radianos" },
  rad: { label: "RAD", name: "radianos", next: "graus" },
};
// Botões de operador (destacados enquanto a operação espera o segundo número).
let operatorButtons = [];

// Liga a interface ao documento: visor, indicadores, botões de operador e o painel do histórico (abrir, fechar, desktop).
function bindUi(doc, win) {
  display = doc.getElementById("display");
  expressionElement = doc.getElementById("expression");
  expressionDocument = doc;
  calculatorElement = doc.getElementById("calculator");
  historyOpen = doc.getElementById("history-open");
  historyPanel = doc.getElementById("history-panel");
  historyClose = doc.getElementById("history-close");
  memoryIndicator = doc.getElementById("memory-indicator");
  parenIndicator = doc.getElementById("paren-indicator");
  parenSymbols = doc.getElementById("paren-symbols");
  parenText = doc.getElementById("paren-text");
  angleUnitButton = doc.getElementById("angle-unit");
  secondaryToggle = doc.getElementById("secondary-toggle");

  // Nome primário de cada botão com função secundária: o aria-label que keypad.js gerou (ou o rótulo visível, se não houver).
  secondaryButtons = ACTIONS.filter((action) => action.secondary !== undefined)
    .map((action) => {
      const button = doc.getElementById(action.buttonId);
      return button ? { action, button, primaryAriaLabel: button.getAttribute("aria-label") } : null;
    })
    .filter((item) => item !== null);

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

// Classe de tamanho de fonte do visor, pelo número de caracteres do texto (o valor cru, sem separadores).
function displaySizeClass(text) {
  return DISPLAY_SIZES.find((size) => text.length <= size.maxLength).className;
}

// Número puro do visor: sinal opcional, parte inteira e parte decimal (que pode estar sendo digitada, ex.: "1234.").
const PLAIN_NUMBER = /^(-?)(\d+)(\.\d*)?$/;

// Texto do visor com separador de milhar (CALC-23): 8065 vira 8,065. Só mexe em número puro; Erro e notação científica saem como estão.
// O valor interno (state.current) não muda: cópia, histórico e contas usam o texto cru.
function formatDisplay(text) {
  const match = PLAIN_NUMBER.exec(text);
  if (match === null) {
    return text;
  }
  const [, sign, integer, fraction = ""] = match;
  return sign + integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + fraction;
}

// Símbolos dos operadores que a linha da expressão destaca (+, −, ×, ÷, xʸ e ʸ√x da 2nd do xʸ), tirados do registro ACTIONS: é o que o botão mostra.
const OPERATOR_TEXTS = new Set(
  ACTIONS.filter((action) => action.type === "binary").flatMap((action) =>
    action.secondary === undefined ? [action.label] : [action.label, action.secondary.label],
  ),
);

// Partes da expressão em andamento: a conta guardada (state.expression) e, se houver, o número que está sendo digitado.
// Sem operador nem grupo pendente não há expressão (ex.: 16 e depois √x mostra só o resultado), e depois do igual a conta sai.
function expressionParts(state) {
  if (state.expression.length === 0) {
    return [];
  }
  const parts = [...state.expression];
  // O número em digitação entra na expressão; depois de operador, de "(" ou de grupo fechado, o visor já é o que falta.
  if (!state.waitingForOperand && !state.valueIsGroup) {
    parts.push(state.current);
  }
  return parts;
}

// Desenha a linha da expressão: cada parte vira um span, e os operadores ganham a classe de destaque (CSS).
function renderExpression(state) {
  const nodes = expressionParts(state).map((part) => {
    const span = expressionDocument.createElement("span");
    span.textContent = part;
    if (OPERATOR_TEXTS.has(part)) {
      span.className = "expression-operator";
    }
    return span;
  });
  expressionElement.replaceChildren(...nodes);
}

// Desenha o visor e os indicadores a partir do estado recebido (quem chama guarda o estado).
function render(state) {
  if (display) {
    display.textContent = formatDisplay(state.current);
    for (const size of DISPLAY_SIZES) {
      display.classList.remove(size.className);
    }
    display.classList.add(displaySizeClass(state.current));
  }
  if (expressionElement) {
    renderExpression(state);
  }

  // Operador destacado (aria-pressed="true", estilizado no CSS): só enquanto o segundo número não começou.
  // ʸ√x (2nd do xʸ, CALC-71) é o operador pendente da tecla xʸ, então destaca essa tecla.
  const pendingOperator = state.waitingForOperand ? trailingOperator(state) : null;
  const selectedOperator = pendingOperator === "root" ? "power" : pendingOperator;
  for (const button of operatorButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.action === selectedOperator));
  }

  // Tecla 2nd: aria-pressed="true" (estilizado no CSS) enquanto ativa. Os botões com função secundária mostram o rótulo dela nesse caso.
  if (secondaryToggle) {
    secondaryToggle.setAttribute("aria-pressed", String(state.secondary));
  }
  for (const { action, button, primaryAriaLabel } of secondaryButtons) {
    const label = state.secondary ? action.secondary.label : action.label;
    const name = state.secondary ? action.secondary.ariaLabel : (primaryAriaLabel ?? action.label);
    button.textContent = label;
    button.setAttribute("aria-label", name);
  }

  // Indicador de memória: visível só enquanto houver valor guardado.
  if (memoryIndicator) {
    memoryIndicator.hidden = state.memory === 0;
  }

  // Unidade angular: o botão DEG/RAD mostra a unidade atual o tempo todo, e o rótulo acessível diz a atual e a próxima.
  if (angleUnitButton) {
    const unit = ANGLE_UNITS[state.angleUnit];
    angleUnitButton.textContent = unit.label;
    angleUnitButton.setAttribute("aria-label", `${unit.label} (${unit.name}), trocar para ${unit.next}`);
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
