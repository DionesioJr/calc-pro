// Checagem de formatação sem dependências. Não reescreve arquivos: só aponta o que está fora do padrão.
// Regras: sem tab na indentação; sem espaço no fim da linha; quebras de linha consistentes (LF ou CRLF,
// não misturados); exatamente uma quebra de linha no fim do arquivo; no máximo uma linha em branco seguida.
// Uso: npm run format:check
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT, arquivosJavaScript } from "./arquivos.mjs";

function problemasDe(texto) {
  const problemas = [];

  const crlf = (texto.match(/\r\n/g) || []).length;
  const lf = (texto.match(/\n/g) || []).length - crlf;
  if (crlf > 0 && lf > 0) {
    problemas.push("quebras de linha misturadas (LF e CRLF)");
  }
  if (texto.length > 0 && !texto.endsWith("\n")) {
    problemas.push("falta quebra de linha no fim do arquivo");
  }
  if (/\n\r?\n$/.test(texto)) {
    problemas.push("linha em branco no fim do arquivo");
  }

  const linhas = texto.split("\n");
  if (linhas[linhas.length - 1] === "") {
    linhas.pop();
  }

  let anteriorEmBranco = false;
  linhas.forEach((bruta, indice) => {
    const linha = bruta.endsWith("\r") ? bruta.slice(0, -1) : bruta;
    const numero = indice + 1;
    const emBranco = linha.trim() === "";

    if (/^[ ]*\t/.test(linha)) {
      problemas.push(`linha ${numero}: tab na indentação`);
    }
    if (/[ \t]$/.test(linha)) {
      problemas.push(`linha ${numero}: espaço no fim da linha`);
    }
    if (emBranco && anteriorEmBranco) {
      problemas.push(`linha ${numero}: mais de uma linha em branco seguida`);
    }
    anteriorEmBranco = emBranco;
  });

  return problemas;
}

const arquivos = arquivosJavaScript();
const problemas = [];

for (const arquivo of arquivos) {
  const texto = readFileSync(path.join(ROOT, arquivo), "utf8");
  for (const problema of problemasDe(texto)) {
    problemas.push(`${arquivo}: ${problema}`);
  }
}

if (problemas.length > 0) {
  console.error(problemas.join("\n"));
  console.error(`format:check: ${problemas.length} problema(s) de formatação.`);
  process.exitCode = 1;
} else {
  console.log(`format:check: ${arquivos.length} arquivos no padrão.`);
}
