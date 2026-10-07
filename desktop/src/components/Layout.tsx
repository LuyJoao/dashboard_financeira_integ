import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const iniciais = user!.nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-1">
          <span className="mr-4 font-semibold">Pagamentos</span>
          <NavLink to="/" end className={linkCls}>Dashboard</NavLink>
          <NavLink to="/empresas" className={linkCls}>Empresas</NavLink>
          <NavLink to="/importar" className={linkCls}>Importar</NavLink>
          {user!.role === "admin" && <NavLink to="/usuarios" className={linkCls}>Usuários</NavLink>}
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white">
            {iniciais}
          </div>
          <span className="text-sm">{user!.nome}</span>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900">Sair</button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
