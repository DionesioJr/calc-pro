// Testes de src/history.js sozinho, com um storage falso (mesma assinatura do localStorage: getItem, setItem, removeItem)
// e um DOM mínimo. Cobrem o carregamento, o salvamento, a lista, o uso de um item e a confirmação de Limpar (CALC-54).
// Sem dependências: rodar com `npm test` (node --test, Node 18+).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src/history.js é um script clássico (o navegador o carrega sem import/export): aqui ele é avaliado e as funções são devolvidas.
const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
function carregarScripts(arquivos, nomes) {
  const codigo = arquivos.map((arquivo) => fs.readFileSync(path.join(SRC_DIR, arquivo), "utf8")).join("\n;\n");
  return new Function(`${codigo}\nreturn { ${nomes.join(", ")} };`)();
}
const { addCalculation, bindHistory } = carregarScripts(["history.js"], ["addCalculation", "bindHistory"]);

// Chave que src/history.js usa no storage.
const HISTORY_KEY = "calc-pro:historico";

// Elemento do DOM mínimo: texto, filhos, atributos, hidden, foco e um listener por evento.
function createElement(tagName) {
  const listeners = {};
  const attributes = {};
  return {
    tagName,
    textContent: "",
    className: "",
    type: "",
    hidden: false,
    focused: false,
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return name in attributes ? attributes[name] : null;
    },
    focus() {
      this.focused = true;
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type) {
      listeners[type]({});
    },
  };
}

// Documento mínimo: os elementos fixos do painel do histórico, criados pelo id; createElement para os itens.
function createDocument() {
  const byId = {
    "history-list": createElement("ol"),
    "history-empty": createElement("p"),
    "history-actions": createElement("div"),
    "history-clear": createElement("button"),
    "history-confirm": createElement("div"),
    "history-cancel": createElement("button"),
    "history-confirm-yes": createElement("button"),
  };
  return {
    byId,
    getElementById: (id) => byId[id] ?? null,
    createElement,
  };
}

// Storage falso com a mesma assinatura do localStorage; `data` deixa o teste ler o que foi gravado.
function createFakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

// Liga o histórico ao documento falso e ao storage dado. `recalled` guarda os resultados usados pelo visor.
function mount(storage) {
  const doc = createDocument();
  const recalled = [];
  bindHistory(doc, storage, (result) => recalled.push(result));
  const els = doc.byId;
  // Textos da lista na ordem da tela, como "12 × 3 = 36".
  const items = () =>
    els["history-list"].children.map((item) => {
      const [button] = item.children;
      const [expression, result] = button.children;
      return `${expression.textContent} = ${result.textContent}`;
    });
  return { els, recalled, items };
}

describe("CALC-54: carregamento do histórico a partir do storage falso", () => {
  test("o histórico salvo aparece na tela do mais recente para o mais antigo", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify(["1 + 1 = 2", "2 × 3 = 6"]) });
    assert.deepEqual(mount(storage).items(), ["2 × 3 = 6", "1 + 1 = 2"]);
  });

  test("sem nada salvo, mostra a mensagem de vazio e esconde a lista e o botão Limpar", () => {
    const { els } = mount(createFakeStorage());
    assert.equal(els["history-empty"].hidden, false);
    assert.equal(els["history-list"].hidden, true);
    assert.equal(els["history-actions"].hidden, true);
  });

  test("dado que não é JSON vira histórico vazio, sem erro", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: "{não é json" });
    assert.deepEqual(mount(storage).items(), []);
  });

  test("dado salvo que não é lista vira histórico vazio", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify({ a: 1 }) });
    assert.deepEqual(mount(storage).items(), []);
  });

  test("itens que não são texto no formato 'expressão = resultado' são descartados", () => {
    const saved = ["1 + 1 = 2", 5, "lixo", null, "3 × 3 = 9"];
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify(saved) });
    assert.deepEqual(mount(storage).items(), ["3 × 3 = 9", "1 + 1 = 2"]);
  });

  test("storage que lança erro na leitura vira histórico vazio, sem quebrar o painel", () => {
    const storage = {
      getItem: () => {
        throw new Error("armazenamento bloqueado");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    const { els, items } = mount(storage);
    assert.deepEqual(items(), []);
    assert.equal(els["history-empty"].hidden, false);
  });

  test("a etiqueta do item separa expressão e resultado: 'usar no visor' para leitor de tela", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify(["12 × 3 = 36"]) });
    const { els } = mount(storage);
    const [button] = els["history-list"].children[0].children;
    assert.equal(button.getAttribute("aria-label"), "12 × 3 igual a 36, usar no visor");
  });
});

describe("CALC-54: gravação no storage falso", () => {
  test("addCalculation grava a lista em JSON e mostra o item na tela", () => {
    const storage = createFakeStorage();
    const { els, items } = mount(storage);
    addCalculation("3 + 4 = 7");
    assert.deepEqual(JSON.parse(storage.data[HISTORY_KEY]), ["3 + 4 = 7"]);
    assert.deepEqual(items(), ["3 + 4 = 7"]);
    assert.equal(els["history-empty"].hidden, true);
    assert.equal(els["history-actions"].hidden, false);
  });

  test("falha ao gravar não quebra: o histórico continua na tela até fechar a página", () => {
    const storage = createFakeStorage();
    storage.setItem = () => {
      throw new Error("cota cheia");
    };
    const { items } = mount(storage);
    assert.doesNotThrow(() => addCalculation("2 × 2 = 4"));
    assert.deepEqual(items(), ["2 × 2 = 4"]);
  });
});

describe("CALC-54: uso de um item do histórico", () => {
  test("tocar num item chama o callback com o resultado (o visor mostra só o resultado)", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify(["12 × 3 = 36", "1 + 1 = 2"]) });
    const { els, recalled } = mount(storage);
    // Na tela o mais recente vem primeiro: "1 + 1 = 2" é o item 0 e "12 × 3 = 36" é o item 1.
    const [button] = els["history-list"].children[1].children;
    button.dispatch("click");
    assert.deepEqual(recalled, ["36"]);
  });
});

describe("CALC-54: confirmação de Limpar histórico", () => {
  test("Limpar pede confirmação: esconde o botão, mostra a pergunta e foca Cancelar", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify(["1 + 1 = 2"]) });
    const { els, items } = mount(storage);
    els["history-clear"].dispatch("click");
    assert.equal(els["history-clear"].hidden, true);
    assert.equal(els["history-confirm"].hidden, false);
    assert.equal(els["history-cancel"].focused, true);
    assert.deepEqual(items(), ["1 + 1 = 2"]);
    assert.equal(HISTORY_KEY in storage.data, true);
  });

  test("Cancelar esconde a confirmação, devolve o foco a Limpar e mantém o histórico", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify(["1 + 1 = 2"]) });
    const { els, items } = mount(storage);
    els["history-clear"].dispatch("click");
    els["history-cancel"].dispatch("click");
    assert.equal(els["history-confirm"].hidden, true);
    assert.equal(els["history-clear"].hidden, false);
    assert.equal(els["history-clear"].focused, true);
    assert.deepEqual(items(), ["1 + 1 = 2"]);
    assert.deepEqual(JSON.parse(storage.data[HISTORY_KEY]), ["1 + 1 = 2"]);
  });

  test("Apagar esvazia a lista, remove a chave do storage e foca a mensagem de vazio", () => {
    const storage = createFakeStorage({ [HISTORY_KEY]: JSON.stringify(["1 + 1 = 2", "2 × 3 = 6"]) });
    const { els, items } = mount(storage);
    els["history-clear"].dispatch("click");
    els["history-confirm-yes"].dispatch("click");
    assert.deepEqual(items(), []);
    assert.equal(HISTORY_KEY in storage.data, false);
    assert.equal(els["history-confirm"].hidden, true);
    assert.equal(els["history-clear"].hidden, false);
    assert.equal(els["history-empty"].hidden, false);
    assert.equal(els["history-empty"].focused, true);
  });
});
