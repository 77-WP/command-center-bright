import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // SW registration is best-effort; app works without it
  });
}

createRoot(document.getElementById("root")!).render(<App />);
