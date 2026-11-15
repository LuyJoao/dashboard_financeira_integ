import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { api, registrarAoExpirar } from "../api/client";
import { apagarToken, carregarToken, lerToken, salvarToken } from "../lib/token";

export type User = { id: number; nome: string; email: string; role: "admin" | "user" };

type AuthState = {
  user: User | null;
  loading: boolean;
  sessaoExpirada: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  // Qualquer 401 (fora do login) limpa o usuário; o ProtectedRoute então redireciona ao /login.
  useEffect(() => {
    registrarAoExpirar(() => {
      setUser(null);
      setSessaoExpirada(true);
    });
    return () => registrarAoExpirar(null);
  }, []);

  // Ao abrir: carrega o token guardado (seguro, no Electron) e confirma com o servidor.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        await carregarToken();
        if (lerToken()) {
          try {
            const r = await api.get<User>("/api/auth/me");
            if (ativo) setUser(r.data);
          } catch (e) {
            if (isAxiosError(e) && e.response?.status === 401) await apagarToken();
            else console.error("Não foi possível validar a sessão armazenada:", e);
          }
        }
      } catch (e) {
        console.error("Não foi possível carregar a sessão armazenada:", e);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const login = async (email: string, senha: string) => {
    const { data } = await api.post("/api/auth/login", { email, senha });
    await salvarToken(data.access_token);
    const me = await api.get<User>("/api/auth/me");
    setUser(me.data);
    setSessaoExpirada(false);
  };

  const logout = async () => {
    await apagarToken();
    setUser(null);
    setSessaoExpirada(false);
  };

  return <AuthCtx.Provider value={{ user, loading, sessaoExpirada, login, logout }}>{children}</AuthCtx.Provider>;
}
