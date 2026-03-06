import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline } from "@mui/material";
import "./runtime/field-type-plugin-bootstrap.js";
import App from "./app/App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CssBaseline />
    <App />
  </StrictMode>
);
