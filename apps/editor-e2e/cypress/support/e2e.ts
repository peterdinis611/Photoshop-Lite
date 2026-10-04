/// <reference types="cypress" />

Cypress.on('uncaught:exception', (err) => {
  // Konva / WASM init noise should not fail e2e
  if (/ResizeObserver|wasm|ort\./i.test(err.message)) {
    return false;
  }
  return true;
});

export {};
