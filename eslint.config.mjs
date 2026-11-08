import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/"],
  },
  js.configs.recommended,
  {
    // Roda no navegador como script clássico (index.html carrega cada src/*.js com <script>, sem type="module").
    // As funções de topo de cada arquivo ficam no escopo global da página, então só se checa variável não usada dentro da função.
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": ["error", { vars: "local" }],
    },
  },
  {
    // Nomes que este arquivo usa de outros arquivos de src/ (carregados antes, no mesmo escopo global).
    files: ["src/ui.js"],
    languageOptions: {
      globals: {
        OPEN_PAREN: "readonly",
        OPERATIONS: "readonly",
        openDepth: "readonly",
        trailingOperator: "readonly",
      },
    },
  },
  {
    files: ["src/keyboard.js"],
    languageOptions: {
      globals: {
        hideHistoryPanel: "readonly",
        isHistoryPanelShown: "readonly",
      },
    },
  },
  {
    files: ["src/main.js"],
    languageOptions: {
      globals: {
        deleteDigit: "readonly",
        handleButton: "readonly",
        initialState: "readonly",
        showResult: "readonly",
        addCalculation: "readonly",
        bindHistory: "readonly",
        bindKeyboard: "readonly",
        bindUi: "readonly",
        hideHistoryPanel: "readonly",
        render: "readonly",
      },
    },
  },
  {
    // Testes em módulo ES no Node (import), com o mesmo package.json "type": "module".
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
];
