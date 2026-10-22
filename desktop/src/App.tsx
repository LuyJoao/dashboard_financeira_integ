import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Placeholder } from "./components/Placeholder";
import { ProtectedRoute } from "./components/ProtectedRoute";
import EsqueciSenha from "./pages/EsqueciSenha";
import Login from "./pages/Login";
import RedefinirSenha from "./pages/RedefinirSenha";
import Usuarios from "./pages/Usuarios";
import Lancamentos from "./pages/Lancamentos";
import Importar from "./pages/Importar";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Routes>
      {/* Recuperação de senha e login ficam acessíveis sem sessão autenticada. */}
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />

      {/* As rotas internas compartilham o layout; usuários são restritos a admins. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="empresas" element={<Placeholder titulo="Empresas e pagamentos" />} />
          <Route path="importar" element={<Importar />} />
          <Route path="lancamentos" element={<Lancamentos />} />
          <Route element={<ProtectedRoute admin />}>
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
