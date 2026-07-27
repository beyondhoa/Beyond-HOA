import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Fall back directly to your production backend URL for Capacitor / native builds
const API_URL = import.meta.env.VITE_API_URL || "https://workspaceapi-server-production-74ae.up.railway.app";

setBaseUrl(API_URL);
setAuthTokenGetter(() => localStorage.getItem("hoa_token"));

createRoot(document.getElementById("root")!).render(<App />);