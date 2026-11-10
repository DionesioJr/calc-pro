// Teclado da calculadora (CALC-59): gera a linha de funções (.scientific) e o teclado numérico (.keypad) a partir do registro ACTIONS (calculator.js).
// Este módulo decide só a ordem na tela (que é a ordem de tabulação), a classe CSS e o aria-label de cada botão.
// Tipo, rótulo, id (buttonId) e data-value/data-action vêm do registro, então o símbolo do botão não é repetido aqui.
// Script clássico, carregado depois de calculator.js (usa ACTIONS, ACTION_BY_ID e datasetOf de lá). Sem import/export.

const DIGIT_CLASS = "btn btn-digit";

// Linha de funções, na ordem da tela. aria-label é o nome completo para leitor de tela; sem ele, o rótulo visível serve.
const FUNCTION_ROW = [
  { id: "memory-clear", className: "memory-clear", ariaLabel: "Limpar memória (MC)" },
  { id: "memory-recall", className: "memory-recall", ariaLabel: "Recuperar memória (MR)" },
  { id: "memory-add", className: "memory-add", ariaLabel: "Somar à memória (M+)" },
  { id: "memory-subtract", className: "memory-subtract", ariaLabel: "Subtrair da memória (M-)" },
  { id: "square", className: "square-add", ariaLabel: "Elevar ao quadrado (x²)" },
  { id: "log", className: "log-button", ariaLabel: "Logaritmo na base 10 (log)" },
  { id: "ln", className: "ln-add", ariaLabel: "Logaritmo natural (ln)" },
  { id: "sine", className: "sine-add", ariaLabel: "Seno (sen)" },
  { id: "cos", className: "cos-add", ariaLabel: "Cosseno (cos)" },
  { id: "tan", className: "tan-add", ariaLabel: "Tangente (tan)" },
  { id: "power", className: "power-add", ariaLabel: "Elevar à potência (xʸ)" },
  { id: "pi", className: "pi-add", ariaLabel: "Inserir pi (π)" },
  { id: "euler", className: "e-add", ariaLabel: "Inserir número de Euler (e)" },
  { id: "exp", className: "exp-add", ariaLabel: "Expoente de base 10 (EXP, ×10ˣ)" },
  { id: "inverse", className: "inverse-add", ariaLabel: "Inverso (1/x)" },
  { id: "factorial", className: "factorial-add", ariaLabel: "Fatorial (x!)" },
  { id: "sqrt", className: "sqrt-add", ariaLabel: "Raiz quadrada (√x)" },
  { id: "open-paren", className: "paren-add", ariaLabel: "Abrir parêntese (" },
  { id: "close-paren", className: "paren-add", ariaLabel: "Fechar parêntese )" },
  { id: "ans", className: "ans-add", ariaLabel: "Último resultado (Ans)" },
];

// Teclado numérico, linha a linha (4 colunas no CSS): 20 botões. O ⌫ fica no fim, para não deslocar os demais.
const KEYPAD = [
  { id: "all-clear", className: "btn btn-function", ariaLabel: "Limpar" },
  { id: "toggle-sign", className: "btn btn-function", ariaLabel: "Inverter sinal" },
  { id: "percent", className: "btn btn-function", ariaLabel: "Porcentagem" },
  { id: "divide", className: "btn btn-operator", ariaLabel: "Dividir" },
  { id: "7", className: DIGIT_CLASS },
  { id: "8", className: DIGIT_CLASS },
  { id: "9", className: DIGIT_CLASS },
  { id: "multiply", className: "btn btn-operator", ariaLabel: "Multiplicar" },
  { id: "4", className: DIGIT_CLASS },
  { id: "5", className: DIGIT_CLASS },
  { id: "6", className: DIGIT_CLASS },
  { id: "subtract", className: "btn btn-operator", ariaLabel: "Subtrair" },
  { id: "1", className: DIGIT_CLASS },
  { id: "2", className: DIGIT_CLASS },
  { id: "3", className: DIGIT_CLASS },
  { id: "add", className: "btn btn-operator", ariaLabel: "Somar" },
  { id: "0", className: "btn btn-digit btn-zero" },
  { id: ".", className: DIGIT_CLASS, ariaLabel: "Ponto decimal" },
  { id: "equals", className: "btn btn-operator", ariaLabel: "Igual" },
  { id: "backspace", className: "btn btn-function", ariaLabel: "Apagar último dígito (Backspace)" },
];

// Marcação de um botão: type, id (só se a ação tem buttonId), class, data-value ou data-action, aria-label (se houver), e o rótulo do registro.
function buttonMarkup(entry) {
  const action = ACTION_BY_ID.get(entry.id);
  if (action === undefined) {
    throw new Error(`teclado: ${entry.id} não existe no registro ACTIONS`);
  }
  const [name, value] = Object.entries(datasetOf(action))[0];
  const id = action.buttonId === undefined ? "" : ` id="${action.buttonId}"`;
  const ariaLabel = entry.ariaLabel === undefined ? "" : ` aria-label="${entry.ariaLabel}"`;
  return `<button type="button"${id} class="${entry.className}" data-${name}="${value}"${ariaLabel}>${action.label}</button>`;
}

// HTML das duas colunas do teclado, sem o contêiner: { scientific, keypad }.
function keypadMarkup() {
  return {
    scientific: FUNCTION_ROW.map(buttonMarkup).join(""),
    keypad: KEYPAD.map(buttonMarkup).join(""),
  };
}

// index.html traz as duas colunas vazias; esta função põe o markup gerado dentro delas. É o HTML que o navegador mostra,
// e os testes leem esse mesmo texto para conferir os botões.
function fillKeypadMarkup(html) {
  const { scientific, keypad } = keypadMarkup();
  return html
    .replace('<div class="scientific"></div>', () => `<div class="scientific">${scientific}</div>`)
    .replace('<div class="keypad"></div>', () => `<div class="keypad">${keypad}</div>`);
}

// Preenche as duas colunas do documento com o markup gerado. Chamado por start() em src/main.js, antes de ligar os eventos.
function renderKeypad(doc) {
  const { scientific, keypad } = keypadMarkup();
  const scientificElement = doc.querySelector(".scientific");
  if (scientificElement) {
    scientificElement.innerHTML = scientific;
  }
  const keypadElement = doc.querySelector(".keypad");
  if (keypadElement) {
    keypadElement.innerHTML = keypad;
  }
}
