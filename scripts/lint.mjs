// Lint sem dependências: confere se cada arquivo JavaScript do projeto tem sintaxe válida (node --check).
// Uso: npm run lint
import { execFileSync } from "node:child_process";
import { ROOT, arquivosJavaScript } from "./arquivos.mjs";

const arquivos = arquivosJavaScript();
let falhas = 0;

for (const arquivo of arquivos) {
  try {
    execFileSync(process.execPath, ["--check", arquivo], { cwd: ROOT, stdio: "inherit" });
  } catch {
    falhas += 1;
  }
}

if (falhas > 0) {
  console.error(`lint: ${falhas} de ${arquivos.length} arquivo(s) com erro de sintaxe.`);
  process.exitCode = 1;
} else {
  console.log(`lint: ${arquivos.length} arquivos sem erro de sintaxe.`);
}
