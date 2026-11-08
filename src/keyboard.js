"use strict";

// Teclado físico: cada tecla executa a mesma ação do botão correspondente (mesmo caminho do clique).
// Não guarda estado: as ações (press e backspace) vêm de main.js, que atualiza o estado e redesenha.
// Tecla → ação, a partir das teclas de cada entrada de ACTIONS (calculator.js): botões e atalhos saem do mesmo registro (CALC-53).
// Ex.: m e M somam à memória; ( e ) abrem e fecham parênteses (Shift + 9 e Shift + 0 no teclado).
const ACTION_BY_KEY = new Map(ACTIONS.flatMap((action) => (action.keys ?? []).map((key) => [key, action])));

// Ids dos botões fora do teclado numérico que têm tecla (M+, MR, MC, M-, π, x!, xʸ, ( e )): o destaque de tecla pressionada usa esta lista.
const KEY_BUTTON_IDS = ACTIONS.filter((action) => action.keys && action.buttonId).map((action) => action.buttonId);

// Botões que recebem as mesmas teclas além do teclado numérico: o destaque e o efeito de tecla pressionada usam esta lista.
let pressableButtons = [];

// Tecla física pressionada: o botão correspondente escurece até a tecla ser solta, ou até a janela perder o foco.
// Indexado pelo código físico (event.code), para que soltar a tecla com outro caractere (ex.: Shift) ainda a libere.
const heldKeys = new Map();

// Liga o teclado físico ao documento e à janela. Os botões que recebem tecla são os do teclado numérico, mais os de KEY_BUTTON_IDS.
// actions: press(dataset) para cada tecla de botão e backspace() para Backspace (main.js atualiza o estado e redesenha).
function bindKeyboard(doc, win, actions) {
  heldKeys.clear();
  const keypad = doc.querySelector(".keypad");
  const buttons = keypad ? Array.from(keypad.querySelectorAll("button")) : [];
  pressableButtons = [...buttons, ...KEY_BUTTON_IDS.map((id) => doc.getElementById(id))].filter(Boolean);

  doc.addEventListener("keydown", (event) => {
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
    if (!handleKey(event.key, actions)) {
      return;
    }

    const dataset = datasetForKey(event.key);
    if (dataset !== null) {
      holdKey(event.code || event.key, findButton(dataset));
    }

    // Impede que Enter, com um botão da calculadora focado, dispare também o clique desse botão.
    event.preventDefault();
  });

  doc.addEventListener("keyup", (event) => {
    releaseKey(event.code || event.key);
  });

  // Sem essa liberação, uma tecla solta com a janela fora de foco deixaria o botão escurecido.
  if (win) {
    win.addEventListener("blur", releaseAllKeys);
  }
}

// Tecla → dataset no mesmo formato de data-value/data-action; null se a tecla não tem botão (ex.: Backspace).
function datasetForKey(key) {
  const action = ACTION_BY_KEY.get(key);
  return action === undefined ? null : datasetOf(action);
}

// Botão do teclado correspondente a um dataset (ex.: { value: "7" } ou { action: "add" }), ou null.
function findButton(dataset) {
  const attribute = dataset.value !== undefined ? "value" : "action";
  return pressableButtons.find((button) => button.dataset[attribute] === dataset[attribute]) ?? null;
}

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
function handleKey(key, actions) {
  if (key === "Backspace") {
    actions.backspace();
    return true;
  }
  const dataset = datasetForKey(key);
  if (dataset === null) {
    return false;
  }
  actions.press(dataset);
  return true;
}
