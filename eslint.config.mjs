import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/"],
  },
  js.configs.recommended,
  {
    // Roda no navegador como script clássico (não é módulo).
    files: ["script.js"],
    languageOptions: {
      sourceType: "script",
      globals: globals.browser,
    },
  },
  {
    // Testes em CommonJS (require) e ferramentas em ESM, ambos no Node.
    files: ["test/**/*.js", "scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
];
