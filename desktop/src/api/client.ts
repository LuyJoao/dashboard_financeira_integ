import axios from "axios";
import { apagarToken, lerToken } from "../lib/token";

export const TOKEN_KEY = "token"; // mantido por compatibilidade; o token agora é gerenciado em lib/token.ts

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

// O AuthContext registra aqui o que fazer quando a sessão expira.
let aoExpirar: (() => void) | null = null;
export function registrarAoExpirar(fn: (() => void) | null) {
  aoExpirar = fn;
}

api.interceptors.request.use((config) => {
  const token = lerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // 401 no login significa "senha errada", não "sessão expirada"
    const ehLogin = String(error.config?.url ?? "").includes("/api/auth/login");
    if (axios.isAxiosError(error) && error.response?.status === 401 && !ehLogin) {
      void apagarToken();
      aoExpirar?.();
    }
    return Promise.reject(error);
  }
);

export function mensagemErro(e: unknown, padrao = "Algo deu errado. Tente novamente."): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data?.detail;
    if (typeof d === "string") return d;
    if (!e.response) return "Não foi possível conectar ao servidor.";
  }
  return padrao;
}
