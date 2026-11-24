"use strict";

// Interface: desenha o visor e os indicadores a partir do estado, e controla o modo expandido (funções extras) e o painel do histórico.
// Tamanho do display pelo número de caracteres exibidos (sinal e ponto contam). Os nomes display-64/48/40 são herdados:
// a faixa de tamanho continua a mesma, e o CSS (display.css) define os pixels de cada uma.
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
// Linha de expressão acima do resultado (ex.: 8000+65) e o botão ⋯ que expande o cartão.
let expressionElement = null;
let moreToggle = null;
// Símbolos de operador na expressão, tirados do registro ACTIONS (rótulo das binárias e a função 2nd do xʸ, ʸ√x): saem em verde (ver .expression-operator em display.css).
const OPERATOR_TEXTS = ACTIONS.filter((action) => action.type === "binary").flatMap((action) => [
  action.label,
  ...(action.secondary === undefined ? [] : [action.secondary.label]),
]);

// Separador de milhar com vírgula, só na exibição (o estado guarda o número sem separador): 8065 → 8,065.
// Textos que não são número (Erro, notação científica) voltam iguais.
function groupThousands(text) {
  const match = /^(-?)(\d+)(\.\d*)?$/.exec(text);
  if (!match) {
    return text;
  }
  const [, sign, integer, fraction = ""] = match;
  return sign + integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + fraction;
}

// Modo expandido: o cartão mostra as funções extras, o status, o Histórico e os atalhos (classe is-expanded, em tema.css).
function toggleMorePanel() {
  if (!calculatorElement || !moreToggle) {
    return;
  }
  const expanded = !calculatorElement.classList.contains("is-expanded");
  if (expanded) {
    calculatorElement.classList.add("is-expanded");
  } else {
    calculatorElement.classList.remove("is-expanded");
  }
  moreToggle.setAttribute("aria-expanded", String(expanded));
}

// Expressão em curso, parte por parte, sem o "=" do fim. Operadores saem em span próprio, para ganhar a cor de operador.
function renderExpression(parts) {
  const escape = (text) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  expressionElement.innerHTML = parts
    .filter((part) => part !== "=")
    .map((part) => {
      const operator = OPERATOR_TEXTS.includes(part) ? ' class="expression-operator"' : "";
      return `<span${operator}>${escape(part)}</span>`;
    })
    .join("");
}

// Liga a interface ao documento: visor, indicadores, botões de operador, o botão ⋯ e o painel do histórico (abrir e fechar).
function bindUi(doc) {
  display = doc.getElementById("display");
  expressionElement = doc.getElementById("expression");
  moreToggle = doc.getElementById("more-toggle");
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

  // O histórico é um painel por cima do cartão, aberto pelo botão Histórico (modo expandido) e fechado pelo × ou por Escape.
  if (historyOpen) {
    historyOpen.addEventListener("click", showHistoryPanel);
  }
  if (historyClose) {
    historyClose.addEventListener("click", hideHistoryPanel);
  }
  if (moreToggle) {
    moreToggle.addEventListener("click", toggleMorePanel);
  }
}

// Classe de tamanho de fonte do visor, pelo número de caracteres do texto.
function displaySizeClass(text) {
  return DISPLAY_SIZES.find((size) => text.length <= size.maxLength).className;
}

// Desenha o visor e os indicadores a partir do estado recebido (quem chama guarda o estado).
function render(state) {
  if (display) {
    display.textContent = groupThousands(state.current);
    for (const size of DISPLAY_SIZES) {
      display.classList.remove(size.className);
    }
    display.classList.add(displaySizeClass(state.current));
  }
  if (expressionElement) {
    renderExpression(state.expression);
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
