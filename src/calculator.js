"use strict";

// Lógica da calculadora: estado, entrada de números e operadores, funções, parênteses e igual.
// Funções puras, sem DOM, sem armazenamento e sem imports: recebem o estado e devolvem um estado novo (o recebido não muda).
// Quem desenha o visor e lê os botões é ui.js, keyboard.js e main.js; quem grava o histórico também é main.js, a partir das linhas devolvidas.

const ERROR_TEXT = "Erro";

// Máximo de algarismos digitados num número (sinal, ponto e zeros à esquerda da parte inteira não contam).
const MAX_DIGITS = 9;

// Resultados são arredondados para no máximo 8 casas decimais.
const DECIMAL_PLACES = 8;

// Resultado com valor absoluto acima de 2^53 não é exato em double (ex.: 999999999 × 999999999 perderia algarismos): mostra Erro.
const MAX_RESULT = 2 ** 53;

// Número digitado com EXP (×10ˣ) fora da faixa do visor vai para notação científica: abaixo de 1e-6 (e diferente de zero) ou acima de 2^53.
const SMALL_ENTRY = 1e-6;

// Expoente digitado depois de EXP tem no máximo 3 algarismos. Expoente que estoura o double (ex.: 1 EXP 400) mostra Erro.
const MAX_EXPONENT_DIGITS = 3;

// Marcador de grupo aberto dentro de terms e da pilha. Um ")" nunca fica guardado: ao fechar, o grupo vira número.
const OPEN_PAREN = "(";

// Base negativa com expoente fracionário, ou 0 elevado a negativo, dão NaN ou Infinity: a conta falha como as outras (Erro).
// root (2nd do xʸ, CALC-71): ʸ√x, com o índice antes e o radicando depois (3 ʸ√x 27 = 3).
const OPERATIONS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => (b === 0 ? null : a / b),
  power: (a, b) => a ** b,
  root: (index, radicand) => nthRoot(index, radicand),
};

// Precedência: xʸ e ʸ√x antes de × e ÷, e × e ÷ antes de + e −. Entre operadores de mesma precedência vale a ordem da esquerda para a direita,
// exceto xʸ, que associa à direita (2 xʸ 3 xʸ 2 = 2 xʸ 9 = 512). ʸ√x associa à esquerda.
const PRECEDENCE = {
  add: 1,
  subtract: 1,
  multiply: 2,
  divide: 2,
  power: 3,
  root: 3,
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
  root: "ʸ√x",
};

// ʸ√x: raiz de índice index do radicando (o número que vem depois). Índice zero não tem raiz: a conta falha (Erro).
// Radicando negativo só tem raiz real com índice ímpar inteiro (3 ʸ√x −8 = −2); com índice par ou fracionário, a conta falha (Erro).
// Devolve null nesses casos, como a divisão por zero.
function nthRoot(index, radicand) {
  if (index === 0) {
    return null;
  }
  if (radicand >= 0) {
    return radicand ** (1 / index);
  }
  if (!Number.isInteger(index) || index % 2 === 0) {
    return null;
  }
  return -((-radicand) ** (1 / index));
}

// Estado inicial da calculadora (visor 0, sem conta, memória vazia).
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
    // Quantos caracteres do fim do visor são editáveis pelo ⌫: dígitos e ponto digitados, ou o texto inteiro de π e e.
    // Um resultado de função, MR, Ans, grupo fechado ou Erro começa com 0, e o ⌫ não mexe nele (nem no que sobrar de um dígito digitado em cima dele).
    typing: 0,
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
    // Último resultado calculado com sucesso (Ans), como texto do visor: vem de = e das funções unárias que deram certo.
    // Erro, AC e a própria tecla Ans não o substituem. null até a primeira conta: Ans então insere 0.
    lastResult: null,
    // Valor completo do visor quando ele é uma constante (e): o visor mostra 8 casas, o cálculo usa o número inteiro.
    // Qualquer outra mudança no visor passa por setCurrent, que zera este campo.
    exact: null,
    // Expoente sendo digitado depois de EXP (×10ˣ), ou null. mantissa é o número do visor antes do EXP; sign é 1 ou -1; digits são os algarismos do expoente.
    // Enquanto ele existe, o visor mostra o valor (1,5 EXP 3 mostra 1500). Qualquer tecla que não seja de expoente o fecha.
    exponent: null,
    // Unidade angular do sen, cos e tan: "deg" (padrão ao abrir a página) ou "rad". Trocar a unidade não mexe no visor, na conta nem na memória.
    angleUnit: "deg",
    // true enquanto a tecla 2nd está ativa: a próxima função (ação unária, ou xʸ) roda a função secundária do botão, se ele tiver uma, e a 2nd volta a false.
    // Dígitos, outros operadores e o igual não a desligam. AC não a desliga (só uma função a desliga).
    secondary: false,
    // Linhas do histórico geradas pela última ação ("12 × 3 = 36"). handleButton as devolve e zera; quem chama as grava.
    pendingHistory: [],
  };
}

// Cópia do estado para a ação trabalhar sem mexer no original: as listas são copiadas, o resto são valores simples.
function cloneState(state) {
  return {
    ...state,
    stack: [...state.stack],
    terms: [...state.terms],
    expression: [...state.expression],
    exponent: state.exponent === null ? null : { ...state.exponent },
    pendingHistory: [],
  };
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

// Texto que sobra ao apagar um caractere do número em edição: se não for um número válido (ex.: "-"), volta para 0.
const VALID_ENTRY = /^-?\d+(\.\d*)?$/;

// Registro único das ações da calculadora (CALC-53): os botões e os atalhos de teclado derivam daqui.
// id: data-value (dígitos e ponto) ou data-action (o resto) do botão.
// type: digit, binary, unary, constant, memory ou control.
// label: símbolo do botão. keys: teclas do teclado físico que disparam a ação. buttonId: id do botão fora do teclado numérico.
// replacesDisplay: true quando a ação troca o número do visor; aplicada a um grupo fechado, o texto do grupo sai da expressão (ver dropGroupText).
// secondary: função da tecla 2nd ({ label, ariaLabel, apply }), quando o botão tem uma. Com a 2nd ativa, apply dá lugar a ela.
// apply(s): age na cópia s do estado.
// Para uma função unária nova: uma entrada aqui, com a função em apply, e uma linha em FUNCTION_ROW (src/keypad.js), que gera o botão. handleButton não muda.
const ACTIONS = [
  ...["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(digitAction),
  {
    id: ".",
    type: "digit",
    label: ".",
    keys: [".", ","],
    apply: (s) => {
      implicitMultiplication(s);
      inputDecimal(s);
    },
  },
  { id: "add", type: "binary", label: "+", keys: ["+"], apply: (s) => inputOperator(s, "add") },
  { id: "subtract", type: "binary", label: "−", keys: ["-"], apply: subtractOrExponentSign },
  { id: "multiply", type: "binary", label: "×", keys: ["*"], apply: (s) => inputOperator(s, "multiply") },
  { id: "divide", type: "binary", label: "÷", keys: ["/"], apply: (s) => inputOperator(s, "divide") },
  {
    id: "power",
    type: "binary",
    label: "xʸ",
    keys: ["^"],
    buttonId: "power-button",
    apply: (s) => inputOperator(s, "power"),
    secondary: { label: "ʸ√x", ariaLabel: "Raiz de índice y (ʸ√x)", apply: (s) => inputOperator(s, "root") },
  },
  { id: "percent", type: "unary", label: "%", replacesDisplay: true, apply: percent },
  { id: "toggle-sign", type: "unary", label: "+/-", replacesDisplay: true, apply: toggleSign },
  {
    id: "square",
    type: "unary",
    label: "x²",
    buttonId: "square-button",
    replacesDisplay: true,
    apply: square,
    secondary: { label: "√x", ariaLabel: "Raiz quadrada (√x)", apply: squareRoot },
  },
  {
    id: "log",
    type: "unary",
    label: "log",
    buttonId: "log-button",
    replacesDisplay: true,
    apply: logarithm,
    secondary: { label: "10ˣ", ariaLabel: "Potência de base 10 (10ˣ)", apply: powerOfTen },
  },
  {
    id: "ln",
    type: "unary",
    label: "ln",
    buttonId: "ln-button",
    replacesDisplay: true,
    apply: naturalLogarithm,
    secondary: { label: "eˣ", ariaLabel: "Exponencial de base e (eˣ)", apply: exponentialE },
  },
  {
    id: "sine",
    type: "unary",
    label: "sen",
    buttonId: "sine-button",
    replacesDisplay: true,
    apply: sine,
    secondary: { label: "asen", ariaLabel: "Arco-seno (asen)", apply: arcSine },
  },
  {
    id: "cos",
    type: "unary",
    label: "cos",
    buttonId: "cos-button",
    replacesDisplay: true,
    apply: cosine,
    secondary: { label: "acos", ariaLabel: "Arco-cosseno (acos)", apply: arcCosine },
  },
  {
    id: "tan",
    type: "unary",
    label: "tan",
    buttonId: "tan-button",
    replacesDisplay: true,
    apply: tangent,
    secondary: { label: "atan", ariaLabel: "Arco-tangente (atan)", apply: arcTangent },
  },
  // Unidade do sen, cos e tan (DEG/RAD): não mexe no visor, na conta pendente, na memória nem no Erro, por isso não tem replacesDisplay.
  { id: "angle-unit", type: "control", label: "DEG", buttonId: "angle-unit", apply: toggleAngleUnit },
  // Tecla 2nd (CALC-69): liga e desliga a função secundária. Fica na linha de status, fora da grade, como o DEG/RAD.
  { id: "secondary", type: "control", label: "2nd", buttonId: "secondary-toggle", apply: toggleSecondary },
  { id: "inverse", type: "unary", label: "1/x", buttonId: "inverse-button", replacesDisplay: true, apply: inverse },
  {
    id: "sqrt",
    type: "unary",
    label: "√x",
    buttonId: "sqrt-button",
    replacesDisplay: true,
    apply: squareRoot,
    secondary: { label: "x³", ariaLabel: "Potência de três (x³)", apply: cube },
  },
  {
    id: "factorial",
    type: "unary",
    label: "x!",
    keys: ["!"],
    buttonId: "factorial-button",
    replacesDisplay: true,
    apply: factorial,
  },
  {
    id: "pi",
    type: "constant",
    label: "π",
    keys: ["p", "P"],
    buttonId: "pi-button",
    replacesDisplay: true,
    apply: insertPi,
  },
  {
    id: "euler",
    type: "constant",
    label: "e",
    buttonId: "e-button",
    replacesDisplay: true,
    apply: insertEuler,
  },
  // EXP (×10ˣ): tecla E do teclado. Fica na linha de funções (src/keypad.js), não no teclado numérico.
  { id: "exp", type: "control", label: "EXP", keys: ["E"], buttonId: "exp-button", apply: startExponent },
  {
    id: "memory-add",
    type: "memory",
    label: "M+",
    keys: ["m", "M"],
    buttonId: "memory-add",
    apply: memoryAdd,
  },
  {
    id: "memory-subtract",
    type: "memory",
    label: "M-",
    keys: ["_"],
    buttonId: "memory-subtract",
    apply: memorySubtract,
  },
  {
    id: "memory-clear",
    type: "memory",
    label: "MC",
    keys: ["c", "C"],
    buttonId: "memory-clear",
    apply: memoryClear,
  },
  {
    id: "memory-recall",
    type: "memory",
    label: "MR",
    keys: ["r", "R"],
    buttonId: "memory-recall",
    replacesDisplay: true,
    apply: memoryRecall,
  },
  // Ans: insere o último resultado calculado (ou 0, sem resultado ainda), substituindo o número em curso, como a MR.
  {
    id: "ans",
    type: "constant",
    label: "Ans",
    buttonId: "ans-button",
    replacesDisplay: true,
    apply: insertAnswer,
  },
  { id: "all-clear", type: "control", label: "AC", keys: ["Escape"], apply: reset },
  {
    id: "backspace",
    type: "control",
    label: "⌫",
    keys: ["Backspace"],
    // deleteDigit devolve um estado novo; applyButton não usa o retorno, então o resultado é copiado para s.
    apply: (s) => Object.assign(s, deleteDigit(s)),
  },
  { id: "equals", type: "control", label: "=", keys: ["=", "Enter"], apply: inputEquals },
  {
    id: "open-paren",
    type: "control",
    label: "(",
    keys: ["("],
    buttonId: "open-paren-button",
    apply: inputOpenParen,
  },
  {
    id: "close-paren",
    type: "control",
    label: ")",
    keys: [")"],
    buttonId: "close-paren-button",
    apply: inputCloseParen,
  },
];

// Ação pelo id (data-value ou data-action), para o motor achar a entrada de um botão.
const ACTION_BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));

// Dígito de 0 a 9: entra no número em edição; depois de um grupo fechado, vira multiplicação implícita.
function digitAction(digit) {
  return {
    id: digit,
    type: "digit",
    label: digit,
    keys: [digit],
    apply: (s) => {
      implicitMultiplication(s);
      inputDigit(s, digit);
    },
  };
}

// data-value (dígitos e ponto) ou data-action do botão da ação, no formato que main.js e keyboard.js passam ao motor.
function datasetOf(action) {
  return action.type === "digit" ? { value: action.id } : { action: action.id };
}

// Reinicia o cálculo em curso, no estado s (que é uma cópia). O histórico e a memória não são apagados aqui (só pelo botão Limpar histórico, ou MC).
function reset(s) {
  setCurrent(s, "0");
  s.stack = [];
  s.terms = [];
  s.waitingForOperand = false;
  s.error = false;
  s.expression = [];
  s.valueIsGroup = false;
  s.exponent = null;
}

// Troca o texto do visor e descarta o valor completo de uma constante (e), se havia um.
// editable é quantos caracteres do fim do texto o ⌫ pode apagar (ver typing em initialState); 0 para qualquer valor que não é entrada.
function setCurrent(s, text, editable = 0) {
  s.current = text;
  s.exact = null;
  s.typing = editable;
}

// Número usado nas contas: o valor completo da constante, se o visor mostra uma; senão, o número do visor.
function operandValue(s) {
  return s.exact !== null ? s.exact : Number(s.current);
}

// Número fechado que entra na sequência crua: o texto do visor, ou o valor completo da constante (String(Math.E) volta ao mesmo double).
function closedNumber(s) {
  return s.exact !== null ? String(s.exact) : s.current;
}

function setError(s) {
  setCurrent(s, ERROR_TEXT);
  s.stack = [];
  s.terms = [];
  s.waitingForOperand = true;
  s.error = true;
  s.expression = [];
  s.valueIsGroup = false;
  s.exponent = null;
}

// Operador pendente (está no fim da pilha), ou null se a pilha termina em número. "(" não é operador.
function trailingOperator(state) {
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

function inputDigit(s, digit) {
  if (s.error) {
    reset(s);
  }
  if (s.exponent !== null) {
    appendExponentDigit(s, digit);
    return;
  }
  if (s.waitingForOperand || isScientific(s.current)) {
    setCurrent(s, digit, 1);
    s.waitingForOperand = false;
    return;
  }
  // Com 9 algarismos, o próximo dígito é ignorado.
  if (countDigits(s.current) >= MAX_DIGITS) {
    return;
  }
  // O "0" inicial é substituído pelo primeiro dígito digitado; senão o dígito soma ao que já é editável.
  if (s.current === "0") {
    setCurrent(s, digit, 1);
  } else {
    setCurrent(s, s.current + digit, s.typing + 1);
  }
}

function inputDecimal(s) {
  if (s.error) {
    reset(s);
  }
  // Expoente de EXP é inteiro: o ponto é ignorado enquanto ele é digitado.
  if (s.exponent !== null) {
    return;
  }
  if (s.waitingForOperand || isScientific(s.current)) {
    setCurrent(s, "0.", 2);
    s.waitingForOperand = false;
    return;
  }
  // Só um ponto decimal por número; um segundo ponto é ignorado.
  if (s.current.includes(".")) {
    return;
  }
  setCurrent(s, s.current + ".", s.typing + 1);
}

// +/-: inverte o sinal do número exibido. Com o zero não há sinal a inverter.
// Após erro, a tecla reinicia a calculadora.
// Depois de um operador, o número exibido vira o segundo operando (o que se vê é o que será usado).
function toggleSign(s) {
  if (s.error) {
    reset(s);
    return;
  }
  // Com EXP aberto, o sinal inverte o expoente (1,5 EXP 3 +/- resulta em 0.0015), não a mantissa.
  if (s.exponent !== null) {
    s.exponent.sign = -s.exponent.sign;
    refreshExponent(s);
    return;
  }
  if (s.current === "0") {
    return;
  }
  // Com a constante, o sinal inverte também o valor completo (−e continua exato).
  // O sinal de um número digitado continua digitado (5, +/- ainda deixa o ⌫ apagar); o de um resultado não vira digitado.
  const exact = s.exact;
  const editable = s.typing;
  setCurrent(s, s.current.startsWith("-") ? s.current.slice(1) : "-" + s.current, editable);
  s.exact = exact === null ? null : -exact;
  s.waitingForOperand = false;
}

// %: com + ou − pendente, o número exibido vira a porcentagem da base, que é o número à esquerda do operador já acumulado na pilha
// (100 − 10% → 100 − 10 = 90; 2 × 3 + 10% → 6 + 0.6). O visor mostra esse valor, que é o que entra na conta e no histórico.
// Em qualquer outro caso (× e ÷, xʸ, início de conta, dentro de "(") vale o percentual em decimal (100 × 10% → 100 × 0.1 = 10).
// Após erro, reinicia.
function percent(s) {
  if (s.error) {
    reset(s);
    return;
  }
  const pending = s.terms[s.terms.length - 1];
  if (pending !== "add" && pending !== "subtract") {
    setCurrent(s, formatResult(operandValue(s) / 100));
    s.waitingForOperand = false;
    return;
  }
  // A pilha termina com o operador pendente; o número logo antes dele é a base, já reduzido pela precedência.
  const base = s.stack[s.stack.length - 2];
  const amount = (base * operandValue(s)) / 100;
  if (!Number.isFinite(amount) || Math.abs(amount) > MAX_RESULT) {
    setError(s);
    return;
  }
  setCurrent(s, formatResult(amount));
  s.waitingForOperand = false;
}

// M+ e M-: somam (sign 1) ou subtraem (sign -1) o número exibido da memória; o visor não muda. Com Erro no visor não faz nada.
// Se o resultado passar de 2^53 em valor absoluto, mostra Erro, como qualquer resultado, e a memória fica como estava.
function changeMemory(s, sign) {
  if (s.error) {
    return;
  }
  const total = s.memory + sign * operandValue(s);
  if (!Number.isFinite(total) || Math.abs(total) > MAX_RESULT) {
    setError(s);
    return;
  }
  s.memory = Number(formatResult(total));
}

function memoryAdd(s) {
  changeMemory(s, 1);
}

// MC: zera a memória, e o indicador some (render). Não mexe no visor, então vale também com Erro, como o AC não apaga a memória.
function memoryClear(s) {
  s.memory = 0;
}

// M-: subtrai o número exibido da memória (ex.: memória 8, visor 3 → memória 5).
function memorySubtract(s) {
  changeMemory(s, -1);
}

// MR: copia a memória para o visor como operando atual, substituindo o número em curso, como o π.
// Memória vazia é 0. A memória não muda. Após Erro, começa uma calculadora nova, como um dígito.
function memoryRecall(s) {
  if (s.error) {
    reset(s);
  }
  setCurrent(s, formatResult(s.memory));
  s.waitingForOperand = false;
}

// Ans: copia o último resultado calculado para o visor como operando atual, substituindo o número em curso, como a MR.
// Sem resultado ainda, insere 0. Após Erro, começa uma calculadora nova, como um dígito; o Erro não entra no lugar do resultado.
function insertAnswer(s) {
  if (s.error) {
    reset(s);
  }
  setCurrent(s, s.lastResult ?? "0");
  s.waitingForOperand = false;
}

// Função aplicada ao visor (ex.: √16, sen(30)) vira uma linha do histórico, com o resultado que ficou no visor.
// Só é chamada quando a função deu certo: Erro não grava.
function recordFunction(s, expression) {
  if (s.functionOnGroup) {
    return;
  }
  s.pendingHistory.push(`${expression} = ${s.current}`);
}

// Negativo entre parênteses nas funções que escrevem o número antes ou depois do símbolo (ex.: (-3)²), para não ler como -(3²).
function operandText(text) {
  return text.startsWith("-") ? `(${text})` : text;
}

// x²: eleva o número exibido ao quadrado, com a mesma regra de segundo operando do % (o visor mostra o resultado).
// Com Erro no visor não calcula e mantém o Erro. Se o quadrado passar de 2^53 em valor absoluto, mostra Erro.
function square(s) {
  if (s.error) {
    return;
  }
  const result = operandValue(s) ** 2;
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError(s);
    return;
  }
  const expression = `${operandText(s.current)}²`;
  setCurrent(s, formatResult(result));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// x³ (2nd do √x, CALC-71): cubo do número exibido, com a mesma regra do x². Acima de 2^53 em valor absoluto mostra Erro.
// Com Erro no visor não calcula e mantém o Erro.
function cube(s) {
  if (s.error) {
    return;
  }
  const result = operandValue(s) ** 3;
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError(s);
    return;
  }
  const expression = `${operandText(s.current)}³`;
  setCurrent(s, formatResult(result));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// log: logaritmo decimal (base 10) do número exibido, com a mesma regra de segundo operando do % e do x²
// (o visor mostra o resultado). Valor menor ou igual a zero não tem logaritmo real: mostra Erro.
// Com Erro no visor não calcula e mantém o Erro.
function logarithm(s) {
  if (s.error) {
    return;
  }
  const value = operandValue(s);
  if (value <= 0) {
    setError(s);
    return;
  }
  const expression = `log(${s.current})`;
  setCurrent(s, formatResult(Math.log10(value)));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// ln: logaritmo natural (base e) do número exibido, com a mesma regra de segundo operando do log
// (o visor mostra o resultado). Valor menor ou igual a zero não tem logaritmo real: mostra Erro.
// Com Erro no visor não calcula e mantém o Erro.
function naturalLogarithm(s) {
  if (s.error) {
    return;
  }
  const value = operandValue(s);
  if (value <= 0) {
    setError(s);
    return;
  }
  const expression = `ln(${s.current})`;
  setCurrent(s, formatResult(Math.log(value)));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

function sineDegrees(degrees) {
  const angle = ((degrees % 360) + 360) % 360;
  if (angle % 90 === 0) {
    return EXACT_SINES[angle / 90];
  }
  return Math.sin((angle * Math.PI) / 180);
}

// sen: troca o número exibido pelo seno dele, com a mesma regra de segundo operando do % e do x².
// A unidade vem de s.angleUnit: em graus usa sineDegrees; em radianos, Math.sin direto sobre o número exibido.
// Com Erro no visor não calcula e mantém o Erro. O seno fica entre -1 e 1, então não há limite de 2^53 a checar.
function sine(s) {
  if (s.error) {
    return;
  }
  const expression = `sen(${s.current})`;
  const value = operandValue(s);
  const result = s.angleUnit === "rad" ? Math.sin(value) : sineDegrees(value);
  setCurrent(s, formatResult(result));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

function cosineDegrees(degrees) {
  const angle = ((degrees % 360) + 360) % 360;
  if (angle % 90 === 0) {
    return EXACT_COSINES[angle / 90];
  }
  return Math.cos((angle * Math.PI) / 180);
}

// cos: troca o número exibido pelo cosseno dele, com a mesma regra do seno (unidade vinda de s.angleUnit).
// Com Erro no visor não calcula e mantém o Erro. O cosseno fica entre -1 e 1, então não há limite de 2^53 a checar.
function cosine(s) {
  if (s.error) {
    return;
  }
  const expression = `cos(${s.current})`;
  const value = operandValue(s);
  const result = s.angleUnit === "rad" ? Math.cos(value) : cosineDegrees(value);
  setCurrent(s, formatResult(result));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// π: insere pi (3.14159265, com as 8 casas de qualquer resultado) como operando, substituindo o número em curso,
// como o sen. Após Erro, começa uma calculadora nova, como um dígito.
// O cálculo usa o valor completo; o visor mostra o que couber.
function insertPi(s) {
  if (s.error) {
    reset(s);
  }
  // Como o e, o π entra no visor como número editável: o ⌫ apaga dígitos dele, então todo o texto é editável.
  const text = formatResult(Math.PI);
  setCurrent(s, text, text.length);
  s.waitingForOperand = false;
}

// e: insere o número de Euler como operando, substituindo o número em curso, como o π. O visor mostra 2.71828183
// (8 casas, como os resultados), mas as contas usam o valor completo (e² = 7.38905610, não 7.38905611).
// Após Erro, começa uma calculadora nova, como um dígito.
function insertEuler(s) {
  if (s.error) {
    reset(s);
  }
  // Todo o texto é editável: o ⌫ pode apagar dígitos do e (e então o valor completo sai, ver setCurrent).
  const text = formatResult(Math.E);
  setCurrent(s, text, text.length);
  s.exact = Math.E;
  s.waitingForOperand = false;
}

// 1/x: troca o número exibido pelo seu inverso, com a mesma regra de segundo operando do %, do x², do sen e do π.
// Zero não tem inverso: mostra Erro. Com Erro no visor não calcula e mantém o Erro.
function inverse(s) {
  if (s.error) {
    return;
  }
  if (operandValue(s) === 0) {
    setError(s);
    return;
  }
  const result = 1 / operandValue(s);
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError(s);
    return;
  }
  const expression = `1/${operandText(s.current)}`;
  setCurrent(s, formatResult(result));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// √x: troca o número exibido pela raiz quadrada dele, com a mesma regra de segundo operando do %, do x², do sen, do π e do 1/x.
// Negativo não tem raiz real: mostra Erro. Com Erro no visor não calcula e mantém o Erro.
// A raiz de um número até 2^53 fica até ~9.5e7, então não há limite de 2^53 a checar.
function squareRoot(s) {
  if (s.error) {
    return;
  }
  const value = operandValue(s);
  if (value < 0) {
    setError(s);
    return;
  }
  const expression = `√${s.current}`;
  setCurrent(s, formatResult(Math.sqrt(value)));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// x!: fatorial do número exibido, só para inteiros não negativos (0! = 1). Negativo e decimal mostram Erro.
// Até 2^53 o resultado é inteiro exato e aparece por extenso; acima disso vai para notação científica (20! → 2.4329020081766E+18).
// Acima de 170! o resultado passa do maior double (Infinity) e mostra Erro de overflow. Com Erro no visor não calcula.
function factorial(s) {
  if (s.error) {
    return;
  }
  const n = Number(s.current);
  if (!Number.isInteger(n) || n < 0) {
    setError(s);
    return;
  }
  // O laço para assim que o produto vira Infinity, então n grande (ex.: 999999999) não custa mais que ~171 multiplicações.
  let result = 1;
  for (let i = 2; i <= n && Number.isFinite(result); i++) {
    result *= i;
  }
  if (!Number.isFinite(result)) {
    setError(s);
    return;
  }
  const expression = `${s.current}!`;
  s.current = Math.abs(result) > MAX_RESULT ? toScientific(result) : formatResult(result);
  s.typing = 0;
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// Notação científica com 14 algarismos significativos, sem zeros à direita na mantissa (2432902008176640000 → 2.4329020081766E+18).
function toScientific(value) {
  const [mantissa, exponent] = value.toExponential(13).split("e");
  return `${mantissa.replace(/\.?0+$/, "")}E${exponent}`;
}

// Resultado (ou número de EXP) em notação científica não é um número em edição: o próximo dígito ou ponto começa um número novo.
function isScientific(text) {
  return /E[+-]\d+$/.test(text);
}

// Número digitado com EXP no visor: o valor completo, em notação científica quando sai da faixa (abaixo de SMALL_ENTRY ou acima de 2^53).
// Dentro da faixa, segue o formato de sempre (até 8 casas), então 1500 sai como 1500 e 0.0015 como 0.0015.
function entryText(value) {
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < SMALL_ENTRY || magnitude > MAX_RESULT)) {
    return toScientific(value);
  }
  return formatResult(value);
}

// EXP (×10ˣ): abre o expoente do número em edição (1,5 EXP 3 → 1500). Sem número digitado antes, o toque é ignorado:
// visor 0, depois de operador ou igual, com Erro, com grupo fechado ou com resultado em notação científica.
// Com o expoente já aberto, outro EXP também é ignorado.
function startExponent(s) {
  if (s.exponent !== null || s.waitingForOperand || s.valueIsGroup || s.current === "0" || isScientific(s.current)) {
    return;
  }
  // typing guarda os caracteres editáveis da mantissa, para o ⌫ voltar a apagá-los quando o EXP fecha.
  s.exponent = { mantissa: s.current, sign: 1, digits: "", typing: s.typing };
  // O número em edição passa a ser o texto do visor, mesmo se era uma constante (e): a conta usa o que o visor mostra.
  setCurrent(s, s.current, s.typing);
}

// Recalcula o visor com o expoente em curso: mantissa × 10^(sign × digits). Escrito como texto ("1.5e3") para não somar ruído de ponto flutuante.
// Expoente que estoura o double (ex.: 1 EXP 400) mostra Erro e fecha o expoente.
function refreshExponent(s) {
  const { mantissa, sign, digits } = s.exponent;
  const value = Number(`${mantissa}e${sign * Number(digits || "0")}`);
  if (!Number.isFinite(value)) {
    setError(s);
    return;
  }
  setCurrent(s, entryText(value));
}

// Algarismo do expoente (até MAX_EXPONENT_DIGITS); o que passar do limite é ignorado.
function appendExponentDigit(s, digit) {
  if (s.exponent.digits.length >= MAX_EXPONENT_DIGITS) {
    return;
  }
  s.exponent.digits += digit;
  refreshExponent(s);
}

// −: com EXP aberto e sem algarismo no expoente, o sinal é do expoente (1,5 EXP − 3 → 0.0015). Em qualquer outro caso é a subtração,
// e a subtração fecha o EXP.
function subtractOrExponentSign(s) {
  if (s.exponent !== null && s.exponent.digits === "") {
    s.exponent.sign = -1;
    return;
  }
  s.exponent = null;
  inputOperator(s, "subtract");
}

function tangentDegrees(degrees) {
  const angle = ((degrees % 180) + 180) % 180;
  if (angle % 45 === 0) {
    return EXACT_TANGENTS[angle / 45];
  }
  return Math.tan((angle * Math.PI) / 180);
}

// Tangente em radianos: nos múltiplos ímpares de π/2 (π/2, 3π/2, ...) não há valor, então devolve null.
// A tolerância é uma unidade da 8ª casa, que é a precisão do visor: π ÷ 2 (com π = 3.14159265) também cai ali e mostra Erro.
// Fora disso, Math.tan direto sobre o número (1.5707963 digitado dá um valor grande, mas real).
function tangentRadians(radians) {
  const nearest = Math.round(radians / (Math.PI / 2));
  if (nearest % 2 !== 0 && Math.abs(radians - nearest * (Math.PI / 2)) <= 10 ** -DECIMAL_PLACES) {
    return null;
  }
  return Math.tan(radians);
}

// tan: troca o número exibido pela tangente dele, com a mesma regra de segundo operando do sen e do 1/x.
// A unidade vem de s.angleUnit: em graus usa tangentDegrees; em radianos, tangentRadians sobre o número exibido.
// Indefinida (90° + 180°·k, ou π/2 + π·k em radianos) ou com resultado acima de 2^53 em valor absoluto: mostra Erro. Com Erro no visor não calcula e mantém o Erro.
function tangent(s) {
  if (s.error) {
    return;
  }
  const value = operandValue(s);
  const result = s.angleUnit === "rad" ? tangentRadians(value) : tangentDegrees(value);
  if (result === null || !Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError(s);
    return;
  }
  const expression = `tan(${s.current})`;
  setCurrent(s, formatResult(result));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// 10ˣ (2nd do log): potência de 10 do número exibido, com a mesma regra de segundo operando do x². Acima de 2^53 em valor absoluto,
// ou não finito (10^400), mostra Erro. Com Erro no visor não calcula e mantém o Erro.
function powerOfTen(s) {
  if (s.error) {
    return;
  }
  const result = 10 ** operandValue(s);
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError(s);
    return;
  }
  const expression = `10^${operandText(s.current)}`;
  setCurrent(s, formatResult(result));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// eˣ (2nd do ln): exponencial de e do número exibido, com a mesma regra do 10ˣ. Acima de 2^53 em valor absoluto, ou não finito, mostra Erro.
// Com Erro no visor não calcula e mantém o Erro.
// O visor mostra 8 casas, mas o valor completo fica em exact: eˣ(1) é o mesmo e da tecla e, e ln dele volta a 1 (CALC-71).
function exponentialE(s) {
  if (s.error) {
    return;
  }
  const result = Math.exp(operandValue(s));
  if (!Number.isFinite(result) || Math.abs(result) > MAX_RESULT) {
    setError(s);
    return;
  }
  const expression = `e^${operandText(s.current)}`;
  setCurrent(s, formatResult(result));
  s.exact = result;
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// Radianos para a unidade do visor (s.angleUnit): em radianos devolve o próprio valor; em graus converte.
function angleFromRadians(s, radians) {
  return s.angleUnit === "rad" ? radians : (radians * 180) / Math.PI;
}

// asen (2nd do sen): arco-seno do número exibido, na unidade do visor. Fora do intervalo de −1 a 1 não há ângulo real: mostra Erro.
// Com Erro no visor não calcula e mantém o Erro.
function arcSine(s) {
  if (s.error) {
    return;
  }
  const value = operandValue(s);
  if (value < -1 || value > 1) {
    setError(s);
    return;
  }
  const expression = `asen(${s.current})`;
  setCurrent(s, formatResult(angleFromRadians(s, Math.asin(value))));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// acos (2nd do cos): arco-cosseno do número exibido, na unidade do visor, com a mesma regra de domínio do asen.
// Com Erro no visor não calcula e mantém o Erro.
function arcCosine(s) {
  if (s.error) {
    return;
  }
  const value = operandValue(s);
  if (value < -1 || value > 1) {
    setError(s);
    return;
  }
  const expression = `acos(${s.current})`;
  setCurrent(s, formatResult(angleFromRadians(s, Math.acos(value))));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// atan (2nd do tan): arco-tangente do número exibido, na unidade do visor. Todo número tem arco-tangente real, então não há Erro de domínio.
// Com Erro no visor não calcula e mantém o Erro.
function arcTangent(s) {
  if (s.error) {
    return;
  }
  const expression = `atan(${s.current})`;
  setCurrent(s, formatResult(angleFromRadians(s, Math.atan(operandValue(s)))));
  s.waitingForOperand = false;
  recordFunction(s, expression);
}

// Botão DEG/RAD: alterna a unidade do sen, cos e tan. Não mexe no visor, na conta pendente, na memória, no histórico nem no Erro.
function toggleAngleUnit(s) {
  s.angleUnit = s.angleUnit === "deg" ? "rad" : "deg";
}

// Tecla 2nd (CALC-69): liga ou desliga a função secundária. Não mexe no visor, na conta, na memória, no histórico nem no Erro.
function toggleSecondary(s) {
  s.secondary = !s.secondary;
}

// ⌫ (botão e Backspace): apaga o último caractere do número em edição. Devolve o estado novo (quem chama copia para o estado em curso).
// Erro não muda (a mensagem fica), e nada mexe em resultado de função, MR, Ans, grupo fechado, notação científica ou no operador pendente:
// só age sobre os caracteres editáveis no fim do visor (s.typing > 0), ou sobre o expoente de um EXP em digitação.
function deleteDigit(state) {
  const s = cloneState(state);
  if (s.error) {
    return s;
  }
  // Com EXP aberto, apaga o último algarismo do expoente; sem algarismo, fecha o EXP e o número volta a ser a mantissa,
  // com os caracteres editáveis que tinha antes do EXP.
  if (s.exponent !== null) {
    if (s.exponent.digits === "") {
      const { mantissa, typing } = s.exponent;
      s.exponent = null;
      setCurrent(s, mantissa, typing);
    } else {
      s.exponent.digits = s.exponent.digits.slice(0, -1);
      refreshExponent(s);
    }
    return s;
  }
  if (s.typing === 0 || s.waitingForOperand || s.valueIsGroup || isScientific(s.current)) {
    return s;
  }
  const remaining = s.current.slice(0, -1);
  if (VALID_ENTRY.test(remaining)) {
    setCurrent(s, remaining, s.typing - 1);
  } else {
    setCurrent(s, "0");
  }
  return s;
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
function openDepth(state) {
  return state.terms.filter((term) => term === OPEN_PAREN).length;
}

// Recalcula a pilha a partir da sequência crua. Devolve false (e mostra Erro) se a conta falhar.
function refreshStack(s) {
  const folded = foldTerms(s.terms);
  if (folded === null) {
    setError(s);
    return false;
  }
  s.stack = folded.stack;
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

function inputOperator(s, operator) {
  if (s.error) {
    reset(s);
  }

  const last = s.terms[s.terms.length - 1];
  if (s.waitingForOperand && isOperator(last)) {
    // Trocar de operador antes do segundo número substitui o anterior (também na expressão e na sequência crua).
    s.terms[s.terms.length - 1] = operator;
    s.expression[s.expression.length - 1] = OPERATOR_SYMBOLS[operator];
  } else if (s.waitingForOperand && last === OPEN_PAREN) {
    // Operador logo depois de "(" não tem número à esquerda dentro do grupo: é ignorado.
    return;
  } else {
    // O número fechado entra na sequência crua (com o valor completo de e). Se for o valor de um grupo fechado, o texto do grupo já está na expressão e não se repete.
    s.terms.push(closedNumber(s), operator);
    if (!s.valueIsGroup) {
      s.expression.push(s.current);
    }
    s.expression.push(OPERATOR_SYMBOLS[operator]);
  }
  s.valueIsGroup = false;

  // A pilha é sempre refeita da sequência crua: assim, trocar o operador também reabre termos já fechados.
  // Ex.: 2 + 3 × deixa o 3 pendente; 2 + 3 × 4 + resolve para 14.
  const folded = foldTerms(s.terms);
  if (folded === null) {
    setError(s);
    return;
  }
  s.stack = folded.stack;
  // Sem redução neste operador, o visor não muda: continua o último número fechado (e, se for a constante, com s.exact).
  if (folded.display !== null) {
    setCurrent(s, folded.display);
  }
  s.waitingForOperand = true;
}

// "(": abre um grupo. Depois de um número ou de um grupo fechado vira multiplicação implícita: 2 ( 3 + 1 ) = 2 × (3 + 1).
// No início (visor 0, sem conta) não há multiplicação.
function inputOpenParen(s) {
  if (s.error) {
    reset(s);
  }
  if (!s.waitingForOperand && (s.valueIsGroup || s.terms.length > 0 || s.current !== "0")) {
    inputOperator(s, "multiply");
    if (s.error) {
      return;
    }
  }
  s.terms.push(OPEN_PAREN);
  s.expression.push("(");
  s.current = "0";
  s.typing = 0;
  s.waitingForOperand = true;
  refreshStack(s);
}

// ")": fecha o grupo mais interno. Só vale com um número no fim do grupo e um "(" aberto; fora disso é ignorado.
function inputCloseParen(s) {
  if (s.error) {
    reset(s);
    return;
  }
  if (openDepth(s) === 0 || s.waitingForOperand) {
    return;
  }
  closeGroup(s);
}

// Fecha o grupo mais interno: o número em curso (se ainda não estiver na sequência) entra no grupo, que é calculado sozinho
// e vira o número do visor, ainda pendente, como um número digitado. Conta que falha no grupo mostra Erro.
function closeGroup(s) {
  const start = s.terms.lastIndexOf(OPEN_PAREN);
  const body = s.terms.slice(start + 1);
  body.push(s.current);
  if (!s.valueIsGroup) {
    s.expression.push(s.current);
  }
  s.expression.push(")");

  const value = evaluateTerms(body);
  s.terms.splice(start);
  if (value === null) {
    setError(s);
    return;
  }
  s.current = formatResult(value);
  s.typing = 0;
  s.waitingForOperand = false;
  s.valueIsGroup = true;
  refreshStack(s);
}

// Operador pendente no fim de um grupo (ex.: "(2 +" seguido de "="): sai, e o número anterior volta a ser o visor.
function dropDanglingOperator(s) {
  const last = s.terms[s.terms.length - 1];
  if (!s.waitingForOperand || !isOperator(last)) {
    return;
  }
  s.terms.pop();
  s.expression.pop();
  s.current = s.terms.pop();
  if (s.expression[s.expression.length - 1] === ")") {
    // O número era o valor de um grupo fechado: o texto do grupo continua na expressão.
    s.valueIsGroup = true;
  } else {
    s.expression.pop();
  }
  s.waitingForOperand = false;
  refreshStack(s);
}

// "(" sem nenhum número depois dele (ex.: "(" seguido de "="): some junto, sem deixar grupo vazio.
function dropOpenParen(s) {
  s.terms.pop();
  s.expression.pop();
  refreshStack(s);
}

// "=" com grupos ainda abertos: fecha cada um, do mais interno para o mais externo.
function closeOpenGroups(s) {
  while (openDepth(s) > 0) {
    dropDanglingOperator(s);
    if (s.error) {
      return;
    }
    if (s.waitingForOperand) {
      dropOpenParen(s);
    } else {
      closeGroup(s);
      if (s.error) {
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
function dropGroupText(s) {
  let depth = 0;
  let start = s.expression.length - 1;
  for (; start >= 0; start--) {
    if (s.expression[start] === ")") {
      depth++;
    } else if (s.expression[start] === "(") {
      depth--;
      if (depth === 0) {
        break;
      }
    }
  }
  if (start >= 0) {
    s.expression.splice(start);
  }
  s.valueIsGroup = false;
}

// Número digitado logo depois de um grupo fechado (ex.: (2 + 3) 4) multiplica o grupo.
function implicitMultiplication(s) {
  if (s.valueIsGroup) {
    inputOperator(s, "multiply");
  }
}

function finishCalculation(s) {
  s.expression = [];
  s.stack = [];
  s.terms = [];
  s.valueIsGroup = false;
  s.waitingForOperand = true;
}

function inputEquals(s) {
  if (s.error) {
    reset(s);
    return;
  }
  closeOpenGroups(s);
  if (s.error) {
    return;
  }

  if (s.stack.length === 0) {
    // Sem operador, só um grupo fechado (ex.: (2 + 3) =): o histórico guarda a expressão com o resultado.
    if (s.expression.length === 0) {
      return;
    }
    if (!s.valueIsGroup) {
      s.expression.push(s.current);
    }
    s.expression.push("=", s.current);
    s.pendingHistory.push(expressionText(s.expression));
    finishCalculation(s);
    return;
  }

  let rightOperand;
  if (s.waitingForOperand) {
    // Igual logo após operador repete o último número como segundo operando (2 + = → 4, como no iOS).
    const operator = s.stack.pop();
    const repeated = s.stack[s.stack.length - 1];
    rightOperand = formatResult(repeated);
    s.stack.push(operator, repeated);
  } else {
    rightOperand = s.current;
    s.stack.push(operandValue(s));
  }

  const reduced = reduceStack(s.stack, 0);
  if (reduced === null) {
    setError(s);
    return;
  }
  setCurrent(s, reduced.result ?? s.current);

  if (!s.valueIsGroup) {
    s.expression.push(rightOperand);
  }
  s.expression.push("=", s.current);
  s.pendingHistory.push(expressionText(s.expression));
  finishCalculation(s);
}

// Ações que não fecham um expoente em digitação: dígitos, ponto, EXP, +/- e − (este último fecha só quando vira subtração).
const EXPONENT_KEEPING_IDS = new Set([..."0123456789", ".", "exp", "toggle-sign", "subtract"]);

// Aplica uma ação ao estado s (uma cópia, que pode ser alterada). dataset é o data-value (dígitos e ponto) ou o data-action do botão.
function applyButton(s, dataset) {
  // data-value identifica dígitos e ponto; data-action, o resto. Um botão com o atributo do tipo errado não faz nada.
  const isDigit = dataset.value !== undefined;
  const action = ACTION_BY_ID.get(isDigit ? dataset.value : dataset.action);
  if (action === undefined || (action.type === "digit") !== isDigit) {
    return;
  }
  // Qualquer outra ação fecha o expoente em digitação: o visor já mostra o valor, e a ação usa esse número.
  if (s.exponent !== null && !EXPONENT_KEEPING_IDS.has(action.id)) {
    s.exponent = null;
  }

  s.functionOnGroup = action.replacesDisplay === true && s.valueIsGroup;
  if (s.functionOnGroup) {
    dropGroupText(s);
  }
  const hadError = s.error;
  // Com a 2nd ativa, roda a função secundária do botão (se houver). Qualquer função unária consome a 2nd, com ou sem secundária;
  // uma binária (xʸ) só a consome quando roda a secundária (ʸ√x). Dígitos, o igual e as outras binárias não a desligam.
  const runSecondary = s.secondary && action.secondary !== undefined;
  (runSecondary ? action.secondary.apply : action.apply)(s);
  if (action.type === "unary" || runSecondary) {
    s.secondary = false;
  }
  s.functionOnGroup = false;
  // Último resultado (Ans): o visor depois de uma conta fechada (= que gravou linha) ou de uma função unária que deu certo.
  // Ação sobre Erro (que reinicia) não conta, e o = sem conta (ex.: depois de AC) não sobrescreve o resultado anterior.
  const calculated = action.type === "unary" || (action.id === "equals" && s.pendingHistory.length > 0);
  if (!hadError && !s.error && calculated) {
    s.lastResult = s.current;
  }
}

// Ação de um botão. Devolve { state, history }: o estado novo e as linhas do histórico que a ação gerou (quem chama grava e redesenha).
function handleButton(state, dataset) {
  const s = cloneState(state);
  applyButton(s, dataset);
  const history = s.pendingHistory;
  s.pendingHistory = [];
  return { state: s, history };
}

// Usa um resultado do histórico (ou de outra fonte) como número do visor: começa um cálculo novo, e o próximo dígito começa um número novo.
function showResult(state, text) {
  const s = cloneState(state);
  reset(s);
  setCurrent(s, text);
  s.waitingForOperand = true;
  return s;
}

// Número colado (Ctrl+V, CALC-72): o texto inteiro tem de ser um número, com sinal opcional, dígitos e um separador decimal ("." ou ",").
const PASTED_NUMBER = /^([+-]?)(\d+(?:[.,]\d*)?|[.,]\d+)$/;

// Colar número: o número vira o operando em edição, como o π e a MR, e substitui o visor (e o grupo fechado, se era o visor).
// Texto que não é número, ou com mais de MAX_DIGITS algarismos, é ignorado: devolve o próprio estado, sem erro.
// Com Erro no visor também não faz nada. Não gera linha de histórico.
function pasteNumber(state, text) {
  const match = PASTED_NUMBER.exec(text.trim());
  if (state.error || match === null) {
    return state;
  }
  const [, sign, body] = match;
  const normalized = body.replace(",", ".");
  if (countDigits(normalized) > MAX_DIGITS) {
    return state;
  }
  // Zeros à esquerda da parte inteira saem ("007" vira 7; ".5" vira 0.5), como na digitação.
  const [integerPart, fractionPart = ""] = normalized.split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const magnitude = fractionPart === "" ? integer : `${integer}.${fractionPart}`;
  const value = Number(magnitude) === 0 ? "0" : sign === "-" ? `-${magnitude}` : magnitude;

  const s = cloneState(state);
  s.exponent = null;
  if (s.valueIsGroup) {
    dropGroupText(s);
  }
  setCurrent(s, value, value.length);
  s.waitingForOperand = false;
  return s;
}
