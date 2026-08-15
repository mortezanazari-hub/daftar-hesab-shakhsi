import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/vazirmatn";
import "../app/globals.css";
import { FinanceApp } from "../app/FinanceApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FinanceApp />
  </React.StrictMode>,
);
