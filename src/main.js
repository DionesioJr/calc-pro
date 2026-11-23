"use strict";

// Ponto de entrada da Calculadora Pro. index.html carrega os scripts de src/ como scripts clássicos, nesta ordem:
// calculator.js, history.js, keypad.js, ui.js, keyboard.js e main.js. Sem import/export: as funções de cada arquivo ficam no escopo global da página.
// Liga os módulos ao documento: teclado numérico, botões de função, histórico, teclado físico e painel do mobile.
// Guarda o estado da calculadora: cada ação passa pelo motor (calculator.js), grava as linhas do histórico e redesenha o visor.

// Botões fora do teclado numérico (linha da memória, linha de funções e DEG/RAD), tirados do registro ACTIONS: cada um executa a ação do próprio data-action.
const FUNCTION_BUTTON_IDS = ACTIONS.filter((action) => action.buttonId).map((action) => action.buttonId);

// Estado da calculadora na tela. Só este módulo o troca; os demais recebem o estado como parâmetro.
let state = initialState();

// Preferências que sobrevivem ao recarregar a página (CALC-73): a memória e a unidade DEG/RAD, e o tema (CALC-8). Ficam num único registro JSON.
const PREFERENCES_KEY = "calc-pro:preferencias";
// Valores de fábrica: memória vazia, graus e tema do sistema, como ao abrir a página pela primeira vez.
const DEFAULT_PREFERENCES = { memory: 0, angleUnit: "deg", theme: "system" };
// Armazenamento usado para gravar as preferências (o mesmo que o histórico recebe em start).
let preferencesStorage = null;
// Tema escolhido: "system" segue prefers-color-scheme; "light" e "dark" são escolha manual (CALC-8).
let themeChoice = DEFAULT_PREFERENCES.theme;

// Lê as preferências salvas. Sem armazenamento, com dado corrompido ou com valor fora do esperado, volta ao padrão, sem erro.
function loadPreferences(storage) {
  try {
    const saved = JSON.parse(storage.getItem(PREFERENCES_KEY));
    const memory = saved.memory;
    return {
      memory: Number.isFinite(memory) && Math.abs(memory) <= MAX_RESULT ? memory : DEFAULT_PREFERENCES.memory,
      angleUnit: saved.angleUnit === "rad" ? "rad" : DEFAULT_PREFERENCES.angleUnit,
      theme: saved.theme === "light" || saved.theme === "dark" ? saved.theme : DEFAULT_PREFERENCES.theme,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

// Grava a memória, a unidade e o tema. Sem armazenamento (ou com cota cheia), a calculadora segue igual; só não lembra ao recarregar.
function savePreferences(storage, s, theme) {
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify({ memory: s.memory, angleUnit: s.angleUnit, theme }));
  } catch {
    // Sem armazenamento: as preferências valem só até fechar a página.
  }
}

// Tema que está na tela: a escolha manual, ou o que o sistema pede (claro só se prefers-color-scheme: light; sem matchMedia, escuro, que é o tema original).
function currentTheme(win) {
  if (themeChoice === "light" || themeChoice === "dark") {
    return themeChoice;
  }
  const systemLight =
    win && typeof win.matchMedia === "function" && win.matchMedia("(prefers-color-scheme: light)").matches;
  return systemLight ? "light" : "dark";
}

// Põe o tema na página (data-theme no <html>, que tema.css usa) e atualiza o botão: o nome acessível diz o tema atual e o próximo, como o botão DEG.
function applyTheme(doc, win) {
  const theme = currentTheme(win);
  if (doc.documentElement) {
    doc.documentElement.setAttribute("data-theme", theme);
  }
  const button = doc.getElementById("theme-toggle");
  if (button) {
    const light = theme === "light";
    button.textContent = light ? "☀" : "☾";
    button.setAttribute(
      "aria-label",
      light ? "Tema claro, trocar para tema escuro" : "Tema escuro, trocar para tema claro",
    );
  }
}

// Botão de tema: troca para o tema oposto ao da tela e grava essa escolha. Com o sistema mudando de tema enquanto a página está aberta, sem escolha manual, o tema acompanha.
function bindTheme(doc, win, storage) {
  const button = doc.getElementById("theme-toggle");
  if (button) {
    button.addEventListener("click", () => {
      themeChoice = currentTheme(win) === "light" ? "dark" : "light";
      savePreferences(storage, state, themeChoice);
      applyTheme(doc, win);
    });
  }
  const query = win && typeof win.matchMedia === "function" ? win.matchMedia("(prefers-color-scheme: light)") : null;
  if (query && typeof query.addEventListener === "function") {
    query.addEventListener("change", () => applyTheme(doc, win));
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
    savePreferences(preferencesStorage, state, themeChoice);
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
  const preferences = loadPreferences(storage);
  state = { ...initialState(), memory: preferences.memory, angleUnit: preferences.angleUnit };
  themeChoice = preferences.theme;
  // Botões primeiro: o teclado e a ligação de eventos abaixo procuram os botões no documento.
  renderKeypad(doc);
  bindHistory(doc, storage, recallFromHistory);
  bindUi(doc, win);
  bindKeyboard(doc, win, { press });
  bindClipboard(doc, win);
  bindTheme(doc, win, storage);

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

  applyTheme(doc, win);
  render(state);
  return { getState: () => state };
}

// Área de transferência (CALC-72): Ctrl+C copia o visor e Ctrl+V cola um número. Chegam pelos eventos copy e paste do documento,
// não pelo keydown (que ignora teclas com Ctrl), e o texto colado vem do próprio evento, sem pedir permissão ao navegador.
function bindClipboard(doc, win) {
  doc.addEventListener("copy", (event) => {
    // Texto selecionado na página (ex.: um item do histórico) segue o comportamento do navegador.
    const selection = win && typeof win.getSelection === "function" ? win.getSelection() : null;
    if (selection && selection.toString() !== "") {
      return;
    }
    if (!event.clipboardData || state.current === "") {
      return;
    }
    // O que está no visor, como aparece (inclusive "Erro" e notação científica).
    event.clipboardData.setData("text/plain", state.current);
    event.preventDefault();
  });

  doc.addEventListener("paste", (event) => {
    // Com o painel do histórico aberto (mobile) a calculadora está inerte, então o texto colado não chega a ela.
    if (isHistoryPanelShown() || !event.clipboardData) {
      return;
    }
    const next = pasteNumber(state, event.clipboardData.getData("text/plain"));
    // Texto que não é número válido: o estado volta igual, sem erro e sem mudança no visor.
    if (next === state) {
      return;
    }
    event.preventDefault();
    state = next;
    render(state);
  });
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
