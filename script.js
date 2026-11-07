"use strict";

const display = document.getElementById("display");
const keypad = document.querySelector(".keypad");

const state = {
  current: "0",
};

function render() {
  if (display) {
    display.textContent = state.current;
  }
}

function inputDigit(digit) {
  // O "0" inicial é substituído pelo primeiro dígito digitado.
  state.current = state.current === "0" ? digit : state.current + digit;
}

function inputDecimal() {
  // Só um ponto decimal por número; um segundo ponto é ignorado.
  if (state.current.includes(".")) {
    return;
  }
  state.current += ".";
}

if (keypad) {
  keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) {
      return;
    }

    const value = button.dataset.value;

    if (value === ".") {
      inputDecimal();
    } else if (/^[0-9]$/.test(value)) {
      inputDigit(value);
    } else {
      return;
    }

    render();
  });
}

render();
