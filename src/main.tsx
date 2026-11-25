import "@fontsource/caveat/500.css";
import "@fontsource/caveat/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing application root.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
