import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Placeholder } from "./components/Placeholder";
import { ProtectedRoute } from "./components/ProtectedRoute";
import EsqueciSenha from "./pages/EsqueciSenha";
import Login from "./pages/Login";
import RedefinirSenha from "./pages/RedefinirSenha";
import Usuarios from "./pages/Usuarios";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Placeholder titulo="Dashboard" />} />
          <Route path="empresas" element={<Placeholder titulo="Empresas e pagamentos" />} />
          <Route path="importar" element={<Placeholder titulo="Importar planilha Excel" />} />
          <Route element={<ProtectedRoute admin />}>
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
