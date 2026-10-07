import axios from "axios";

export const TOKEN_KEY = "token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function mensagemErro(e: unknown, padrao = "Algo deu errado. Tente novamente."): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data?.detail;
    if (typeof d === "string") return d;
    if (!e.response) return "Não foi possível conectar ao servidor.";
  }
  return padrao;
}
