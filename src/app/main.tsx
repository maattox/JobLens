import React from "react";
import ReactDOM from "react-dom/client";
import App from "../popup/App";
import { AppProvider } from "../popup/context/AppContext";
import "../styles/tokens.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider shellMode="tab">
      <App />
    </AppProvider>
  </React.StrictMode>
);
