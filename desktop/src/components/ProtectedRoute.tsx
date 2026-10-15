import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth();
  // Aguarda a restauração da sessão para evitar redirecionar antes da checagem.
  if (loading) return <p className="p-6 text-sm text-slate-500">Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  // Uma sessão válida não implica acesso administrativo.
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
