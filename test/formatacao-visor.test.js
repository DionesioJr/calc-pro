// Testes do separador de milhar do visor (CALC-76, src/ui.js): só a exibição agrupa os dígitos; o estado guarda o número puro.
// Sem DOM: groupThousands é uma função pura, carregada como os demais scripts clássicos de src/ (ver keypad.test.js).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
function carregarScripts(arquivos, nomes) {
  const codigo = arquivos.map((arquivo) => fs.readFileSync(path.join(SRC_DIR, arquivo), "utf8")).join("\n;\n");
  return new Function(`${codigo}\nreturn { ${nomes.join(", ")} };`)();
}
const { groupThousands } = carregarScripts(["calculator.js", "ui.js"], ["groupThousands"]);

describe("CALC-76: separador de milhar com vírgula no visor", () => {
  test("caminho feliz: 8065 vira 8,065 e 1234567 vira 1,234,567", () => {
    assert.equal(groupThousands("8065"), "8,065");
    assert.equal(groupThousands("1234567"), "1,234,567");
  });

  test("números até três algarismos não ganham vírgula: 0, 7, 999", () => {
    assert.equal(groupThousands("0"), "0");
    assert.equal(groupThousands("7"), "7");
    assert.equal(groupThousands("999"), "999");
  });

  test("a parte decimal continua com ponto e sem agrupar: 1234.5678 vira 1,234.5678", () => {
    assert.equal(groupThousands("1234.5678"), "1,234.5678");
    assert.equal(groupThousands("0.5"), "0.5");
    assert.equal(groupThousands("1234."), "1,234.");
  });

  test("sinal de menos não atrapalha: -1234567 vira -1,234,567", () => {
    assert.equal(groupThousands("-1234567"), "-1,234,567");
  });

  test("texto que não é número volta igual: Erro, vazio e notação científica", () => {
    assert.equal(groupThousands("Erro"), "Erro");
    assert.equal(groupThousands(""), "");
    assert.equal(groupThousands("1.5E+34"), "1.5E+34");
  });
});
