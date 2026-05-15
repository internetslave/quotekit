import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";
import { rememberAccessCodeFromUrl } from "./services/apiAccess";
import { registerServiceWorker } from "./services/pwa";

rememberAccessCodeFromUrl();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

registerServiceWorker();
