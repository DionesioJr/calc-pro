// Ponto de entrada da Calculadora Pro (index.html carrega este arquivo como módulo).
// Liga os módulos ao documento: teclado numérico, botões de função, histórico, teclado físico e painel do mobile.
import { handleButton, reset, resetState, setCurrent, state } from "./calculator.js";
import { bindHistory } from "./history.js";
import { bindKeyboard } from "./keyboard.js";
import { bindUi, hideHistoryPanel, render } from "./ui.js";

// Botões fora do teclado numérico (linha da memória e linha de funções): cada um executa a ação do próprio data-action.
const FUNCTION_BUTTON_IDS = [
  "memory-add",
  "memory-subtract",
  "memory-clear",
  "memory-recall",
  "square-button",
  "log-button",
  "ln-button",
  "sine-button",
  "cos-button",
  "tan-button",
  "power-button",
  "pi-button",
  "e-button",
  "inverse-button",
  "factorial-button",
  "sqrt-button",
  "open-paren-button",
  "close-paren-button",
];

// Usar um item do histórico: o resultado vai para o visor, como um dígito novo, e o painel do mobile fecha.
function recallFromHistory(result) {
  recallResult(result);
  hideHistoryPanel();
}

// Clique ou toque num item: o resultado vai para o visor, e o próximo dígito começa um número novo.
function recallResult(result) {
  reset();
  setCurrent(result);
  state.waitingForOperand = true;
  render();
}

// Monta a calculadora sobre o documento dado. Chamado uma vez no navegador; os testes chamam de novo para começar do zero.
export function start(doc, win, storage) {
  resetState();
  bindHistory(doc, storage, recallFromHistory);
  bindUi(doc, win);
  bindKeyboard(doc, win);

  const keypad = doc.querySelector(".keypad");
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

  for (const id of FUNCTION_BUTTON_IDS) {
    const button = doc.getElementById(id);
    if (button) {
      button.addEventListener("click", () => {
        handleButton(button);
        render();
      });
    }
  }

  render();
}

// No navegador, o localStorage pode estar bloqueado (ex.: cookies desligados): o histórico então vale só nesta página.
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  start(document, window, browserStorage());
}
