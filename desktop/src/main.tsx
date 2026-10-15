import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";
import axios from "axios";

// Não repete a requisição quando a resposta é 401 (sessão expirada).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (tentativas, erro) =>
        !(axios.isAxiosError(erro) && erro.response?.status === 401) && tentativas < 2,
    },
  },
});

// HashRouter: funciona com file:// no Electron (BrowserRouter não funciona).
// Os providers compartilham autenticação e cache de dados com todas as telas.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
