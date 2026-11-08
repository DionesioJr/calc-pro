// Sobe a Calculadora Pro em http://localhost:3000 (ou na porta da variável PORT).
// Uso: `npm run dev`, depois abrir o endereço exibido no terminal.

import { fileURLToPath } from "node:url";
import { createStaticServer } from "./static-server.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 3000;

createStaticServer(ROOT).listen(port, "localhost", () => {
  console.log(`Calculadora Pro em http://localhost:${port} (Ctrl+C para parar)`);
});
