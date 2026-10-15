import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, registrarAoExpirar, TOKEN_KEY } from "../api/client";

export type User = { id: number; nome: string; email: string; role: "admin" | "user" };

type AuthState = {
  user: User | null;
  loading: boolean;
  sessaoExpirada: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
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

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/api/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, senha: string) => {
    const { data } = await api.post("/api/auth/login", { email, senha });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    const me = await api.get<User>("/api/auth/me");
    setUser(me.data);
    setSessaoExpirada(false);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setSessaoExpirada(false);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, sessaoExpirada, login, logout }}>{children}</AuthCtx.Provider>
  );
}