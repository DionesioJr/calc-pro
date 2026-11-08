// Histórico de cálculos: guarda no localStorage e desenha a lista do painel (coluna no desktop, tela cheia no mobile).
// Não depende da calculadora: quem usa um item (o resultado vai para o visor) é o callback recebido em bindHistory.

// Histórico de cálculos, no localStorage; do mais antigo para o mais recente.
const HISTORY_KEY = "calc-pro:historico";
const calculationHistory = [];

let storage = null;
let docRef = null;
let onRecall = () => {};
let historyList = null;
let historyEmpty = null;
let historyActions = null;
let historyClear = null;
let historyConfirm = null;
let historyCancel = null;
let historyConfirmYes = null;

// Liga o histórico ao documento e ao armazenamento, carrega o que estava salvo e desenha a lista.
// onUseItem recebe o resultado do item tocado (o visor passa a mostrá-lo).
export function bindHistory(doc, storageObject, onUseItem) {
  docRef = doc;
  storage = storageObject;
  onRecall = onUseItem;
  historyList = doc.getElementById("history-list");
  historyEmpty = doc.getElementById("history-empty");
  historyActions = doc.getElementById("history-actions");
  historyClear = doc.getElementById("history-clear");
  historyConfirm = doc.getElementById("history-confirm");
  historyCancel = doc.getElementById("history-cancel");
  historyConfirmYes = doc.getElementById("history-confirm-yes");

  calculationHistory.length = 0;
  calculationHistory.push(...loadHistory());

  // Limpar pede confirmação: o botão dá lugar a "Apagar todo o histórico?" com Cancelar (foco inicial) e Apagar.
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

  renderHistory();
}

function loadHistory() {
  try {
    const saved = JSON.parse(storage.getItem(HISTORY_KEY));
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
      storage.removeItem(HISTORY_KEY);
    } else {
      storage.setItem(HISTORY_KEY, JSON.stringify(calculationHistory));
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

// Mais recente primeiro. Cada item é um botão (alcançável pelo teclado); texto vai por textContent, nunca como HTML.
function renderHistory() {
  if (!historyList || !historyEmpty) {
    return;
  }
  const items = calculationHistory.slice().reverse().map((text) => {
    const { expression, result } = splitCalculation(text);

    const expressionText = docRef.createElement("span");
    expressionText.className = "history-expression";
    expressionText.textContent = expression;

    const resultText = docRef.createElement("span");
    resultText.className = "history-result";
    resultText.textContent = result;

    const button = docRef.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.setAttribute("aria-label", `${expression} igual a ${result}, usar no visor`);
    button.replaceChildren(expressionText, resultText);
    // No mobile, o painel cobre o visor: ao usar um item, o painel fecha para o resultado aparecer (quem fecha é onRecall).
    button.addEventListener("click", () => {
      onRecall(result);
    });

    const item = docRef.createElement("li");
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

// Grava um cálculo no fim do histórico e redesenha a lista. Chamado pela calculadora ao fechar uma conta ou função.
export function addCalculation(text) {
  calculationHistory.push(text);
  saveHistory();
  renderHistory();
}

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
