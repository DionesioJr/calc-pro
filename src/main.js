"use strict";

// Ponto de entrada da Calculadora Pro. index.html carrega os scripts de src/ como scripts clássicos, nesta ordem:
// calculator.js, history.js, keypad.js, ui.js, keyboard.js e main.js. Sem import/export: as funções de cada arquivo ficam no escopo global da página.
// Liga os módulos ao documento: teclado numérico, botões de função, histórico, teclado físico e painel do mobile.
// Guarda o estado da calculadora: cada ação passa pelo motor (calculator.js), grava as linhas do histórico e redesenha o visor.

// Botões fora do teclado numérico (linha da memória, linha de funções e DEG/RAD), tirados do registro ACTIONS: cada um executa a ação do próprio data-action.
const FUNCTION_BUTTON_IDS = ACTIONS.filter((action) => action.buttonId).map((action) => action.buttonId);

// Estado da calculadora na tela. Só este módulo o troca; os demais recebem o estado como parâmetro.
let state = initialState();

// Preferências que sobrevivem ao recarregar a página (CALC-73): a memória e a unidade DEG/RAD. Ficam num único registro JSON.
const PREFERENCES_KEY = "calc-pro:preferencias";
// Valores de fábrica: memória vazia e graus, como ao abrir a página pela primeira vez.
const DEFAULT_PREFERENCES = { memory: 0, angleUnit: "deg" };
// Armazenamento usado para gravar as preferências (o mesmo que o histórico recebe em start).
let preferencesStorage = null;

// Lê as preferências salvas. Sem armazenamento, com dado corrompido ou com valor fora do esperado, volta ao padrão, sem erro.
function loadPreferences(storage) {
  try {
    const saved = JSON.parse(storage.getItem(PREFERENCES_KEY));
    const memory = saved.memory;
    return {
      memory: Number.isFinite(memory) && Math.abs(memory) <= MAX_RESULT ? memory : DEFAULT_PREFERENCES.memory,
      angleUnit: saved.angleUnit === "rad" ? "rad" : DEFAULT_PREFERENCES.angleUnit,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

// Grava a memória e a unidade. Sem armazenamento (ou com cota cheia), a calculadora segue igual; só não lembra ao recarregar.
function savePreferences(storage, s) {
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify({ memory: s.memory, angleUnit: s.angleUnit }));
  } catch {
    // Sem armazenamento: as preferências valem só até fechar a página.
  }
}

// Uma ação de botão (data-value ou data-action): o motor devolve o estado novo e as linhas do histórico, que são gravadas antes de desenhar.
function press(dataset) {
  const previous = state;
  const result = handleButton(state, dataset);
  state = result.state;
  for (const entry of result.history) {
    addCalculation(entry);
  }
  // Só M+, M-, MC e DEG/RAD mudam o que fica guardado: grava nesses casos, não a cada tecla.
  if (state.memory !== previous.memory || state.angleUnit !== previous.angleUnit) {
    savePreferences(preferencesStorage, state);
  }
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
function start(doc, win, storage) {
  preferencesStorage = storage;
  state = { ...initialState(), ...loadPreferences(storage) };
  // Botões primeiro: o teclado e a ligação de eventos abaixo procuram os botões no documento.
  renderKeypad(doc);
  bindHistory(doc, storage, recallFromHistory);
  bindUi(doc, win);
  bindKeyboard(doc, win, { press });

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
