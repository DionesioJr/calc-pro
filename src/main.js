// Ponto de entrada da Calculadora Pro (index.html carrega este arquivo como módulo).
// Liga os módulos ao documento: teclado numérico, botões de função, histórico, teclado físico e painel do mobile.
// Guarda o estado da calculadora: cada ação passa pelo motor (calculator.js), grava as linhas do histórico e redesenha o visor.
import { ACTIONS, deleteDigit, handleButton, initialState, showResult } from "./calculator.js";
import { addCalculation, bindHistory } from "./history.js";
import { bindKeyboard } from "./keyboard.js";
import { bindUi, hideHistoryPanel, render } from "./ui.js";

// Botões fora do teclado numérico (linha da memória e linha de funções), tirados do registro ACTIONS: cada um executa a ação do próprio data-action.
const FUNCTION_BUTTON_IDS = ACTIONS.filter((action) => action.buttonId).map((action) => action.buttonId);

// Estado da calculadora na tela. Só este módulo o troca; os demais recebem o estado como parâmetro.
let state = initialState();

// Uma ação de botão (data-value ou data-action): o motor devolve o estado novo e as linhas do histórico, que são gravadas antes de desenhar.
function press(dataset) {
  const result = handleButton(state, dataset);
  state = result.state;
  for (const entry of result.history) {
    addCalculation(entry);
  }
  render(state);
}

// Backspace do teclado: apaga o último caractere do número em edição.
function backspace() {
  state = deleteDigit(state);
  render(state);
}

// Usar um item do histórico: o resultado vai para o visor, como um dígito novo, e o painel do mobile fecha.
function recallFromHistory(result) {
  recallResult(result);
  hideHistoryPanel();
}

// Clique ou toque num item: o resultado vai para o visor, e o próximo dígito começa um número novo.
function recallResult(result) {
  state = showResult(state, result);
  render(state);
}

// Monta a calculadora sobre o documento dado. Chamado uma vez no navegador; os testes chamam de novo para começar do zero.
// Devolve um acesso de leitura ao estado atual (os testes usam para conferir a memória).
export function start(doc, win, storage) {
  state = initialState();
  bindHistory(doc, storage, recallFromHistory);
  bindUi(doc, win);
  bindKeyboard(doc, win, { press, backspace });

  const keypad = doc.querySelector(".keypad");
  if (keypad) {
    keypad.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || !keypad.contains(button)) {
        return;
      }

      press(button.dataset);
    });
  }

  for (const id of FUNCTION_BUTTON_IDS) {
    const button = doc.getElementById(id);
    if (button) {
      button.addEventListener("click", () => {
        press(button.dataset);
      });
    }
  }

  render(state);
  return { getState: () => state };
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
