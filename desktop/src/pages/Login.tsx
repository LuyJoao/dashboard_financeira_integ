import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mensagemErro } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { btnCls, inputCls } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await login(email, senha);
      navigate("/");
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <input className={inputCls} type="email" placeholder="E-mail" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input className={inputCls} type="password" placeholder="Senha" value={senha}
          onChange={(e) => setSenha(e.target.value)} required />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnCls} w-full`} disabled={enviando}>{enviando ? "Entrando..." : "Entrar"}</button>
        <Link to="/esqueci-senha" className="block text-center text-sm text-slate-500 hover:text-slate-900">
          Esqueci a senha
        </Link>
      </form>
    </div>
  );
}
