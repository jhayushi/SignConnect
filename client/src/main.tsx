import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/500.css";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
