import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY } from "../api/client";

export type User = { id: number; nome: string; email: string; role: "admin" | "user" };

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}
