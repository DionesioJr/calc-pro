// Lógica da calculadora: estado, entrada de números e operadores, funções, parênteses e igual.
// Não toca no DOM: quem desenha o visor e lê os botões é ui.js, keyboard.js e main.js.
import { addCalculation } from "./history.js";

const ERROR_TEXT = "Erro";

// Máximo de algarismos digitados num número (sinal, ponto e zeros à esquerda da parte inteira não contam).
const MAX_DIGITS = 9;

// Resultados são arredondados para no máximo 8 casas decimais.
const DECIMAL_PLACES = 8;

// Resultado com valor absoluto acima de 2^53 não é exato em double (ex.: 999999999 × 999999999 perderia algarismos): mostra Erro.
const MAX_RESULT = 2 ** 53;

// Marcador de grupo aberto dentro de terms e da pilha. Um ")" nunca fica guardado: ao fechar, o grupo vira número.
export const OPEN_PAREN = "(";

// Base negativa com expoente fracionário, ou 0 elevado a negativo, dão NaN ou Infinity: a conta falha como as outras (Erro).
export const OPERATIONS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => (b === 0 ? null : a / b),
  power: (a, b) => a ** b,
};

// Precedência: xʸ antes de × e ÷, e × e ÷ antes de + e −. Entre operadores de mesma precedência vale a ordem da esquerda para a direita,
// exceto xʸ, que associa à direita (2 xʸ 3 xʸ 2 = 2 xʸ 9 = 512).
const PRECEDENCE = {
  add: 1,
  subtract: 1,
  multiply: 2,
  divide: 2,
  power: 3,
};

const RIGHT_ASSOCIATIVE = {
  power: true,
};

const OPERATOR_SYMBOLS = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "xʸ",
};

function initialState() {
  return {
    current: "0",
    // Conta pendente, em ordem: números e operadores alternados (ex.: [2, "add", 3, "multiply"]).
    // Um operador no fim da pilha é o operador pendente, aguardando o segundo número.
    stack: [],
    // Sequência crua da conta em curso, sem reduzir: números como texto (como digitados; e entra com o valor completo) e nomes de operador.
    // Trocar um operador refaz a pilha a partir daqui, para os termos já fechados voltarem a abrir.
    terms: [],
    // true logo após apertar um operador ou o igual: o próximo dígito começa um novo número.
    waitingForOperand: false,
    // true quando a última operação falhou (divisão por zero).
    error: false,
    // Partes da expressão em curso (ex.: ["12", "×", "3", "="]); viram uma linha do histórico no igual.
    // Parênteses entram como "(" e ")", e o texto do grupo fechado já está aqui quando valueIsGroup é true.
    expression: [],
    // true logo depois de fechar um grupo ")": o número do visor é o valor do grupo, e o texto do grupo já está em expression.
    valueIsGroup: false,
    // true enquanto uma função é aplicada a um grupo fechado: ela não grava linha própria no histórico (a conta que usa o resultado grava).
    functionOnGroup: false,
    // Registrador da memória (M+): soma dos valores do visor. Começa em 0; AC não o apaga, só MC.
    memory: 0,
    // Valor completo do visor quando ele é uma constante (e): o visor mostra 8 casas, o cálculo usa o número inteiro.
    // Qualquer outra mudança no visor passa por setCurrent, que zera este campo.
    exact: null,
  };
}

// Estado único da calculadora. resetState volta tudo ao início sem trocar o objeto (quem o lê continua com a mesma referência).
export const state = initialState();

export function resetState() {
  Object.assign(state, initialState());
}

// Seno em graus (o visor mostra DEG). Múltiplos de 90° saem exatos (sen 0° = 0, sen 90° = 1); os demais usam radianos.
// Reduzir módulo 360 antes evita perder precisão com ângulos grandes.
const EXACT_SINES = [0, 1, 0, -1];

// Cosseno em graus, com a mesma regra do seno: múltiplos de 90° saem exatos (cos 0° = 1, cos 90° = 0, cos 180° = -1, cos 270° = 0),
// sem o ruído de ponto flutuante do Math.cos (ex.: 6.12e-17 em 90°). Os demais usam radianos.
const EXACT_COSINES = [1, 0, -1, 0];

// Tangente em graus (o visor mostra DEG). A tangente tem período de 180°, então o ângulo é reduzido módulo 180 antes.
// Múltiplos de 45° saem exatos (tan 0° = 0, tan 45° = 1, tan 135° = -1); 90° (e 90° + 180°·k) é indefinida: null.
const EXACT_TANGENTS = [0, 1, null, -1];

// Backspace (teclado): apaga o último caractere do número em edição.
// Sem número em edição (após operador ou igual) não faz nada. Após erro, reinicia a calculadora.
// Se sobrar algo que não é um número válido (ex.: "-" ou notação científica), volta para 0.
const VALID_ENTRY = /^-?\d+(\.\d*)?$/;

// Funções que trocam o número do visor. Aplicadas a um grupo fechado, o texto do grupo sai da expressão (ver dropGroupText).
const FUNCTION_ACTIONS = [
  "percent",
  "toggle-sign",
  "square",
  "log",
  "ln",
  "sine",
  "cos",
  "tan",
  "pi",
  "euler",
  "inverse",
  "sqrt",
  "factorial",
  "memory-recall",
];

// Reinicia o cálculo em curso. O histórico não é apagado aqui (só pelo botão Limpar histórico).
export function reset() {
  setCurrent("0");
  state.stack = [];
  state.terms = [];
  state.waitingForOperand = false;
  state.error = false;
  state.expression = [];
  state.valueIsGroup = false;
}

// Troca o texto do visor e descarta o valor completo de uma constante (e), se havia um.
export function setCurrent(text) {
  state.current = text;
  state.exact = null;
}

// Número usado nas contas: o valor completo da constante, se o visor mostra uma; senão, o número do visor.
function operandValue() {
  return state.exact !== null ? state.exact : Number(state.current);
}

// Número fechado que entra na sequência crua: o texto do visor, ou o valor completo da constante (String(Math.E) volta ao mesmo double).
function closedNumber() {
  return state.exact !== null ? String(state.exact) : state.current;
}

function setError() {
  setCurrent(ERROR_TEXT);
  state.stack = [];
  state.terms = [];
  state.waitingForOperand = true;
  state.error = true;
  state.expression = [];
  state.valueIsGroup = false;
}

// Operador pendente (está no fim da pilha), ou null se a pilha termina em número. "(" não é operador.
export function trailingOperator() {
  const last = state.stack[state.stack.length - 1];
  return isOperator(last) ? last : null;
}

// Na sequência crua, operador é o nome (ex.: "add"); número é o texto digitado (ex.: "2", "0.5").
function isOperator(term) {
  return Object.hasOwn(OPERATIONS, term);
}

// Arredonda para no máximo 8 casas decimais e remove os zeros à direita (0.1 + 0.2 → 0.3; 1 ÷ 3 → 0.33333333).
// O arredondamento também elimina o ruído de ponto flutuante. Sem notação científica.
function formatResult(value) {
  const fixed = value.toFixed(DECIMAL_PLACES).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

// Conta os algarismos digitados: sinal e ponto não contam, nem os zeros à esquerda da parte inteira.
function countDigits(entry) {
  const [integerPart, fractionPart = ""] = entry.replace("-", "").split(".");
  return integerPart.replace(/^0+/, "").length + fractionPart.length;
}

function inputDigit(digit) {
  if (state.error) {
    reset();
  }
  if (state.waitingForOperand || isScientific(state.current)) {
    setCurrent(digit);
    state.waitingForOperand = false;
    return;
  }
  // Com 9 algarismos, o próximo dígito é ignorado.
  if (countDigits(state.current) >= MAX_DIGITS) {
    return;
  }
  // O "0" inicial é substituído pelo primeiro dígito digitado.
  setCurrent(state.current === "0" ? digit : state.current + digit);
}

function inputDecimal() {
  if (state.error) {
    reset();
  }
  if (state.waitingForOperand || isScientific(state.current)) {
    setCurrent("0.");
    state.waitingForOperand = false;
    return;
  }
  // Só um ponto decimal por número; um segundo ponto é ignorado.
  if (state.current.includes(".")) {
    return;
  }
  setCurrent(state.current + ".");
}

// +/-: inverte o sinal do número exibido. Com o zero não há sinal a inverter.
// Após erro, a tecla reinicia a calculadora.
// Depois de um operador, o número exibido vira o segundo operando (o que se vê é o que será usado).
function toggleSign() {
  if (state.error) {
    reset();
    return;
  }
  if (state.current === "0") {
    return;
  }
  // Com a constante, o sinal inverte também o valor completo (−e continua exato).
  const exact = state.exact;
  setCurrent(state.current.startsWith("-") ? state.current.slice(1) : "-" + state.current);
  state.exact = exact === null ? null : -exact;
  state.waitingForOperand = false;
}

// %: divide o número exibido por 100. Mesma regra de segundo operando do +/-. Após erro, reinicia.
function percent() {
  if (state.error) {
    reset();
    return;
  }
  setCurrent(formatResult(operandValue() / 100));
  state.waitingForOperand = false;
}

// M+ e M-: somam (sign 1) ou subtraem (sign -1) o número exibido da memória; o visor não muda. Com Erro no visor não faz nada.
// Se o resultado passar de 2^53 em valor absoluto, mostra Erro, como qualquer resultado, e a memória fica como estava.
function changeMemory(sign) {
  if (state.error) {
    return;
  }
  const total = state.memory + sign * operandValue();
  if (!Number.isFinite(total) || Math.abs(total) > MAX_RESULT) {
    setError();
    return;
  }
  state.memory = Number(formatResult(total));
}

function memoryAdd() {
  changeMemory(1);
}

// MC: zera a memória, e o indicador some (render). Não mexe no visor, então vale também com Erro, como o AC não apaga a memória.
function memoryClear() {
  state.memory = 0;
}

// M-: subtrai o número exibido da memória (ex.: memória 8, visor 3 → memória 5).
function memorySubtract() {
  changeMemory(-1);
}

// MR: copia a memória para o visor como operando atual, substituindo o número em curso, como o π.
// Memória vazia é 0. A memória não muda. Após Erro, começa uma calculadora nova, como um dígito.
function memoryRecall() {
  if (state.error) {
    reset();
  }
  setCurrent(formatResult(state.memory));
  state.waitingForOperand = false;
}

// Função aplicada ao visor (ex.: √16, sen(30)) vira uma linha do histórico, com o resultado que ficou no visor.
// Só é chamada quando a função deu certo: Erro não grava.
function recordFunction(expression) {
  if (state.functionOnGroup) {
    return;
  }
  addCalculation(`${expression} = ${state.current}`);
}

// Negativo entre parênteses nas funções que escrevem o número antes ou depois do símbolo (ex.: (-3)²), para não ler como -(3²).
function operandText(text) {
  return text.startsWith("-") ? `(${text})` : text;
}

// x²: eleva o número exibido ao quadrado, com a mesma regra de segundo operando do % (o visor mostra o resultado).
// Com Erro no visor não calcula e mantém o Erro. Se o quadrado passar de 2^53 em valor absoluto, mostra Erro.
function square() {
  if (state.error) {
    return;
  }
  const result = operandValue() ** 2;
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError();
    return;
  }
  const expression = `${operandText(state.current)}²`;
  setCurrent(formatResult(result));
  state.waitingForOperand = false;
  recordFunction(expression);
}

// log: logaritmo decimal (base 10) do número exibido, com a mesma regra de segundo operando do % e do x²
// (o visor mostra o resultado). Valor menor ou igual a zero não tem logaritmo real: mostra Erro.
// Com Erro no visor não calcula e mantém o Erro.
function logarithm() {
  if (state.error) {
    return;
  }
  const value = operandValue();
  if (value <= 0) {
    setError();
    return;
  }
  const expression = `log(${state.current})`;
  setCurrent(formatResult(Math.log10(value)));
  state.waitingForOperand = false;
  recordFunction(expression);
}

// ln: logaritmo natural (base e) do número exibido, com a mesma regra de segundo operando do log
// (o visor mostra o resultado). Valor menor ou igual a zero não tem logaritmo real: mostra Erro.
// Com Erro no visor não calcula e mantém o Erro.
function naturalLogarithm() {
  if (state.error) {
    return;
  }
  const value = operandValue();
  if (value <= 0) {
    setError();
    return;
  }
  const expression = `ln(${state.current})`;
  setCurrent(formatResult(Math.log(value)));
  state.waitingForOperand = false;
  recordFunction(expression);
}

function sineDegrees(degrees) {
  const angle = ((degrees % 360) + 360) % 360;
  if (angle % 90 === 0) {
    return EXACT_SINES[angle / 90];
  }
  return Math.sin((angle * Math.PI) / 180);
}

// sen: troca o número exibido pelo seno dele, com a mesma regra de segundo operando do % e do x².
// Com Erro no visor não calcula e mantém o Erro. O seno fica entre -1 e 1, então não há limite de 2^53 a checar.
function sine() {
  if (state.error) {
    return;
  }
  const expression = `sen(${state.current})`;
  setCurrent(formatResult(sineDegrees(operandValue())));
  state.waitingForOperand = false;
  recordFunction(expression);
}

function cosineDegrees(degrees) {
  const angle = ((degrees % 360) + 360) % 360;
  if (angle % 90 === 0) {
    return EXACT_COSINES[angle / 90];
  }
  return Math.cos((angle * Math.PI) / 180);
}

// cos: troca o número exibido pelo cosseno dele, com a mesma regra do seno.
// Com Erro no visor não calcula e mantém o Erro. O cosseno fica entre -1 e 1, então não há limite de 2^53 a checar.
function cosine() {
  if (state.error) {
    return;
  }
  const expression = `cos(${state.current})`;
  setCurrent(formatResult(cosineDegrees(operandValue())));
  state.waitingForOperand = false;
  recordFunction(expression);
}

// π: insere pi (3.14159265, com as 8 casas de qualquer resultado) como operando, substituindo o número em curso,
// como o sen. Após Erro, começa uma calculadora nova, como um dígito.
// O cálculo usa o valor completo; o visor mostra o que couber.
function insertPi() {
  if (state.error) {
    reset();
  }
  setCurrent(formatResult(Math.PI));
  state.waitingForOperand = false;
}

// e: insere o número de Euler como operando, substituindo o número em curso, como o π. O visor mostra 2.71828183
// (8 casas, como os resultados), mas as contas usam o valor completo (e² = 7.38905610, não 7.38905611).
// Após Erro, começa uma calculadora nova, como um dígito.
function insertEuler() {
  if (state.error) {
    reset();
  }
  setCurrent(formatResult(Math.E));
  state.exact = Math.E;
  state.waitingForOperand = false;
}

// 1/x: troca o número exibido pelo seu inverso, com a mesma regra de segundo operando do %, do x², do sen e do π.
// Zero não tem inverso: mostra Erro. Com Erro no visor não calcula e mantém o Erro.
function inverse() {
  if (state.error) {
    return;
  }
  if (operandValue() === 0) {
    setError();
    return;
  }
  const result = 1 / operandValue();
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError();
    return;
  }
  const expression = `1/${operandText(state.current)}`;
  setCurrent(formatResult(result));
  state.waitingForOperand = false;
  recordFunction(expression);
}

// √x: troca o número exibido pela raiz quadrada dele, com a mesma regra de segundo operando do %, do x², do sen, do π e do 1/x.
// Negativo não tem raiz real: mostra Erro. Com Erro no visor não calcula e mantém o Erro.
// A raiz de um número até 2^53 fica até ~9.5e7, então não há limite de 2^53 a checar.
function squareRoot() {
  if (state.error) {
    return;
  }
  const value = operandValue();
  if (value < 0) {
    setError();
    return;
  }
  const expression = `√${state.current}`;
  setCurrent(formatResult(Math.sqrt(value)));
  state.waitingForOperand = false;
  recordFunction(expression);
}

// x!: fatorial do número exibido, só para inteiros não negativos (0! = 1). Negativo e decimal mostram Erro.
// Até 2^53 o resultado é inteiro exato e aparece por extenso; acima disso vai para notação científica (20! → 2.4329020081766E+18).
// Acima de 170! o resultado passa do maior double (Infinity) e mostra Erro de overflow. Com Erro no visor não calcula.
function factorial() {
  if (state.error) {
    return;
  }
  const n = Number(state.current);
  if (!Number.isInteger(n) || n < 0) {
    setError();
    return;
  }
  // O laço para assim que o produto vira Infinity, então n grande (ex.: 999999999) não custa mais que ~171 multiplicações.
  let result = 1;
  for (let i = 2; i <= n && Number.isFinite(result); i++) {
    result *= i;
  }
  if (!Number.isFinite(result)) {
    setError();
    return;
  }
  const expression = `${state.current}!`;
  state.current = Math.abs(result) > MAX_RESULT ? toScientific(result) : formatResult(result);
  state.waitingForOperand = false;
  recordFunction(expression);
}

// Notação científica com 14 algarismos significativos, sem zeros à direita na mantissa (2432902008176640000 → 2.4329020081766E+18).
function toScientific(value) {
  const [mantissa, exponent] = value.toExponential(13).split("e");
  return `${mantissa.replace(/\.?0+$/, "")}E${exponent}`;
}

// Resultado em notação científica não é um número em edição: o próximo dígito ou ponto começa um número novo.
function isScientific(text) {
  return /E\+\d+$/.test(text);
}

function tangentDegrees(degrees) {
  const angle = ((degrees % 180) + 180) % 180;
  if (angle % 45 === 0) {
    return EXACT_TANGENTS[angle / 45];
  }
  return Math.tan((angle * Math.PI) / 180);
}

// tan: troca o número exibido pela tangente dele, com a mesma regra de segundo operando do sen e do 1/x.
// Indefinida (90° + 180°·k) ou com resultado acima de 2^53 em valor absoluto: mostra Erro. Com Erro no visor não calcula e mantém o Erro.
function tangent() {
  if (state.error) {
    return;
  }
  const result = tangentDegrees(operandValue());
  if (result === null || !Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError();
    return;
  }
  const expression = `tan(${state.current})`;
  setCurrent(formatResult(result));
  state.waitingForOperand = false;
  recordFunction(expression);
}

// Apaga o último caractere do número em edição (Backspace do teclado).
export function deleteDigit() {
  if (state.error) {
    reset();
    return;
  }
  if (state.waitingForOperand) {
    return;
  }
  const remaining = state.current.slice(0, -1);
  setCurrent(VALID_ENTRY.test(remaining) ? remaining : "0");
}

// Calcula a pilha de trás para a frente enquanto o operador logo antes do último número tiver precedência >= minPrecedence.
// Com 0 calcula tudo (no igual); com a precedência de × ou ÷, só fecha o termo de × e ÷ que já estava em curso.
// Como a pilha guarda operadores em ordem crescente de precedência, o de cima é sempre o que vem primeiro.
// Com rightAssociative (xʸ), só fecha operadores de precedência estritamente maior: 2 xʸ 3 xʸ 2 fica para depois, como 2 xʸ (3 xʸ 2).
// Não mexe no estado: devolve { stack, result } (result é o último resultado calculado, ou null se nada foi calculado),
// ou null se a conta falhou (divisão por zero, resultado não finito ou acima de 2^53).
function reduceStack(stack, minPrecedence, rightAssociative = false) {
  let result = null;
  while (
    stack.length >= 3 &&
    (rightAssociative
      ? PRECEDENCE[stack[stack.length - 2]] > minPrecedence
      : PRECEDENCE[stack[stack.length - 2]] >= minPrecedence)
  ) {
    const right = stack.pop();
    const operator = stack.pop();
    const left = stack.pop();
    const value = OPERATIONS[operator](left, right);
    if (value === null || !Number.isFinite(value) || Math.abs(value) > MAX_RESULT) {
      return null;
    }
    result = formatResult(value);
    stack.push(Number(result));
  }
  return { stack, result };
}

// Monta a pilha a partir da sequência crua, reduzindo antes de empilhar cada operador.
// Devolve { stack, display }: display é o resultado do último operador que reduziu, ou null se esse operador não reduziu
// nada (o visor segue mostrando o último número fechado, com o valor completo de e, se for o caso). Ou null se a conta falhou.
function foldTerms(terms) {
  const stack = [];
  let display = null;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (term === OPEN_PAREN) {
      // Grupo aberto: marcador na pilha. reduceStack não passa por ele, então o que está dentro não se mistura com o de fora.
      stack.push(OPEN_PAREN);
    } else if (isOperator(term)) {
      const reduced = reduceStack(stack, PRECEDENCE[term], RIGHT_ASSOCIATIVE[term] === true);
      if (reduced === null) {
        return null;
      }
      display = reduced.result;
      stack.push(term);
    } else {
      stack.push(Number(term));
    }
  }
  return { stack, display };
}

// Quantos grupos estão abertos: cada "(" em terms é um grupo que ainda não foi fechado.
export function openDepth() {
  return state.terms.filter((term) => term === OPEN_PAREN).length;
}

// Recalcula a pilha a partir da sequência crua. Devolve false (e mostra Erro) se a conta falhar.
function refreshStack() {
  const folded = foldTerms(state.terms);
  if (folded === null) {
    setError();
    return false;
  }
  state.stack = folded.stack;
  return true;
}

// Calcula uma sequência crua sozinha (usada para o conteúdo de um grupo). Devolve o valor, ou null se a conta falhar.
function evaluateTerms(terms) {
  const folded = foldTerms(terms);
  if (folded === null) {
    return null;
  }
  const reduced = reduceStack(folded.stack, 0);
  return reduced === null ? null : reduced.stack[0];
}

function inputOperator(operator) {
  if (state.error) {
    reset();
  }

  const last = state.terms[state.terms.length - 1];
  if (state.waitingForOperand && isOperator(last)) {
    // Trocar de operador antes do segundo número substitui o anterior (também na expressão e na sequência crua).
    state.terms[state.terms.length - 1] = operator;
    state.expression[state.expression.length - 1] = OPERATOR_SYMBOLS[operator];
  } else if (state.waitingForOperand && last === OPEN_PAREN) {
    // Operador logo depois de "(" não tem número à esquerda dentro do grupo: é ignorado.
    return;
  } else {
    // O número fechado entra na sequência crua (com o valor completo de e). Se for o valor de um grupo fechado, o texto do grupo já está na expressão e não se repete.
    state.terms.push(closedNumber(), operator);
    if (!state.valueIsGroup) {
      state.expression.push(state.current);
    }
    state.expression.push(OPERATOR_SYMBOLS[operator]);
  }
  state.valueIsGroup = false;

  // A pilha é sempre refeita da sequência crua: assim, trocar o operador também reabre termos já fechados.
  // Ex.: 2 + 3 × deixa o 3 pendente; 2 + 3 × 4 + resolve para 14.
  const folded = foldTerms(state.terms);
  if (folded === null) {
    setError();
    return;
  }
  state.stack = folded.stack;
  // Sem redução neste operador, o visor não muda: continua o último número fechado (e, se for a constante, com state.exact).
  if (folded.display !== null) {
    setCurrent(folded.display);
  }
  state.waitingForOperand = true;
}

// "(": abre um grupo. Depois de um número ou de um grupo fechado vira multiplicação implícita: 2 ( 3 + 1 ) = 2 × (3 + 1).
// No início (visor 0, sem conta) não há multiplicação.
function inputOpenParen() {
  if (state.error) {
    reset();
  }
  if (!state.waitingForOperand && (state.valueIsGroup || state.terms.length > 0 || state.current !== "0")) {
    inputOperator("multiply");
    if (state.error) {
      return;
    }
  }
  state.terms.push(OPEN_PAREN);
  state.expression.push("(");
  state.current = "0";
  state.waitingForOperand = true;
  refreshStack();
}

// ")": fecha o grupo mais interno. Só vale com um número no fim do grupo e um "(" aberto; fora disso é ignorado.
function inputCloseParen() {
  if (state.error) {
    reset();
    return;
  }
  if (openDepth() === 0 || state.waitingForOperand) {
    return;
  }
  closeGroup();
}

// Fecha o grupo mais interno: o número em curso (se ainda não estiver na sequência) entra no grupo, que é calculado sozinho
// e vira o número do visor, ainda pendente, como um número digitado. Conta que falha no grupo mostra Erro.
function closeGroup() {
  const start = state.terms.lastIndexOf(OPEN_PAREN);
  const body = state.terms.slice(start + 1);
  body.push(state.current);
  if (!state.valueIsGroup) {
    state.expression.push(state.current);
  }
  state.expression.push(")");

  const value = evaluateTerms(body);
  state.terms.splice(start);
  if (value === null) {
    setError();
    return;
  }
  state.current = formatResult(value);
  state.waitingForOperand = false;
  state.valueIsGroup = true;
  refreshStack();
}

// Operador pendente no fim de um grupo (ex.: "(2 +" seguido de "="): sai, e o número anterior volta a ser o visor.
function dropDanglingOperator() {
  const last = state.terms[state.terms.length - 1];
  if (!state.waitingForOperand || !isOperator(last)) {
    return;
  }
  state.terms.pop();
  state.expression.pop();
  state.current = state.terms.pop();
  if (state.expression[state.expression.length - 1] === ")") {
    // O número era o valor de um grupo fechado: o texto do grupo continua na expressão.
    state.valueIsGroup = true;
  } else {
    state.expression.pop();
  }
  state.waitingForOperand = false;
  refreshStack();
}

// "(" sem nenhum número depois dele (ex.: "(" seguido de "="): some junto, sem deixar grupo vazio.
function dropOpenParen() {
  state.terms.pop();
  state.expression.pop();
  refreshStack();
}

// "=" com grupos ainda abertos: fecha cada um, do mais interno para o mais externo.
function closeOpenGroups() {
  while (openDepth() > 0) {
    dropDanglingOperator();
    if (state.error) {
      return;
    }
    if (state.waitingForOperand) {
      dropOpenParen();
    } else {
      closeGroup();
      if (state.error) {
        return;
      }
    }
  }
}

// Partes da expressão viram texto: sem espaço depois de "(" nem antes de ")", como em (2 + 3) × 4.
function expressionText(parts) {
  let text = "";
  parts.forEach((part, i) => {
    const glue = i === 0 || parts[i - 1] === "(" || part === ")" ? "" : " ";
    text += glue + part;
  });
  return text;
}

// Função aplicada a um grupo fechado (ex.: (2 + 3) %): o texto do grupo sai da expressão, e o valor novo é o que entra no histórico.
function dropGroupText() {
  let depth = 0;
  let start = state.expression.length - 1;
  for (; start >= 0; start--) {
    if (state.expression[start] === ")") {
      depth++;
    } else if (state.expression[start] === "(") {
      depth--;
      if (depth === 0) {
        break;
      }
    }
  }
  if (start >= 0) {
    state.expression.splice(start);
  }
  state.valueIsGroup = false;
}

// Número digitado logo depois de um grupo fechado (ex.: (2 + 3) 4) multiplica o grupo.
function implicitMultiplication() {
  if (state.valueIsGroup) {
    inputOperator("multiply");
  }
}

function finishCalculation() {
  state.expression = [];
  state.stack = [];
  state.terms = [];
  state.valueIsGroup = false;
  state.waitingForOperand = true;
}

function inputEquals() {
  if (state.error) {
    reset();
    return;
  }
  closeOpenGroups();
  if (state.error) {
    return;
  }

  if (state.stack.length === 0) {
    // Sem operador, só um grupo fechado (ex.: (2 + 3) =): o histórico guarda a expressão com o resultado.
    if (state.expression.length === 0) {
      return;
    }
    if (!state.valueIsGroup) {
      state.expression.push(state.current);
    }
    state.expression.push("=", state.current);
    addCalculation(expressionText(state.expression));
    finishCalculation();
    return;
  }

  let rightOperand;
  if (state.waitingForOperand) {
    // Igual logo após operador repete o último número como segundo operando (2 + = → 4, como no iOS).
    const operator = state.stack.pop();
    const repeated = state.stack[state.stack.length - 1];
    rightOperand = formatResult(repeated);
    state.stack.push(operator, repeated);
  } else {
    rightOperand = state.current;
    state.stack.push(operandValue());
  }

  const reduced = reduceStack(state.stack, 0);
  if (reduced === null) {
    setError();
    return;
  }
  setCurrent(reduced.result ?? state.current);

  if (!state.valueIsGroup) {
    state.expression.push(rightOperand);
  }
  state.expression.push("=", state.current);
  addCalculation(expressionText(state.expression));
  finishCalculation();
}

// Ação de um botão (data-value para dígitos e ponto, data-action para o resto). Não redesenha: quem chama chama render().
export function handleButton(button) {
  if (button.dataset.value !== undefined) {
    const value = button.dataset.value;

    if (value === ".") {
      implicitMultiplication();
      inputDecimal();
    } else if (/^[0-9]$/.test(value)) {
      implicitMultiplication();
      inputDigit(value);
    } else {
      return;
    }
    return;
  }

  const action = button.dataset.action;

  state.functionOnGroup = FUNCTION_ACTIONS.includes(action) && state.valueIsGroup;
  if (state.functionOnGroup) {
    dropGroupText();
  }

  if (action === "all-clear") {
    reset();
  } else if (action === "toggle-sign") {
    toggleSign();
  } else if (action === "percent") {
    percent();
  } else if (action === "equals") {
    inputEquals();
  } else if (action === "memory-add") {
    memoryAdd();
  } else if (action === "memory-subtract") {
    memorySubtract();
  } else if (action === "memory-clear") {
    memoryClear();
  } else if (action === "memory-recall") {
    memoryRecall();
  } else if (action === "square") {
    square();
  } else if (action === "log") {
    logarithm();
  } else if (action === "ln") {
    naturalLogarithm();
  } else if (action === "sine") {
    sine();
  } else if (action === "cos") {
    cosine();
  } else if (action === "tan") {
    tangent();
  } else if (action === "pi") {
    insertPi();
  } else if (action === "euler") {
    insertEuler();
  } else if (action === "inverse") {
    inverse();
  } else if (action === "open-paren") {
    inputOpenParen();
  } else if (action === "close-paren") {
    inputCloseParen();
  } else if (action === "factorial") {
    factorial();
  } else if (action === "sqrt") {
    squareRoot();
  } else if (action in OPERATIONS) {
    inputOperator(action);
  }
  state.functionOnGroup = false;
}
