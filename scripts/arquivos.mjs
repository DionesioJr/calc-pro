// Arquivos JavaScript do projeto analisados pelo lint e pela checagem de formatação.
// Sem dependências: só módulos nativos do Node 18+.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Caminhos relativos à raiz: script.js (roda no navegador), test/ (testes no Node) e scripts/ (estas ferramentas).
export function arquivosJavaScript() {
  const deDiretorio = (dir, extensao) =>
    readdirSync(path.join(ROOT, dir))
      .filter((nome) => nome.endsWith(extensao))
      .map((nome) => path.join(dir, nome));

  return ["script.js", ...deDiretorio("test", ".js"), ...deDiretorio("scripts", ".mjs")];
}
