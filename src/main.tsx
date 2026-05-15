import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { rememberAccessCodeFromUrl } from "./services/apiAccess";
import { registerServiceWorker } from "./services/pwa";

rememberAccessCodeFromUrl();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

registerServiceWorker();
