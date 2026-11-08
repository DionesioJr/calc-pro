import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/"],
  },
  js.configs.recommended,
  {
    // Roda no navegador como módulo ES (index.html carrega src/main.js com type="module").
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.browser,
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
