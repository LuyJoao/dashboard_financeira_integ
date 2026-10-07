import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api, mensagemErro } from "../api/client";
import { btnCls, inputCls } from "../components/ui";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const { data } = await api.post("/api/auth/esqueci-senha", { email });
      setMsg(data.mensagem);
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Recuperar senha</h1>
        <input className={inputCls} type="email" placeholder="E-mail" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnCls} w-full`}>Enviar código</button>
        <Link to="/redefinir-senha" className="block text-center text-sm text-slate-500 hover:text-slate-900">
          Já tenho um código
        </Link>
        <Link to="/login" className="block text-center text-sm text-slate-500 hover:text-slate-900">
          Voltar para o login
        </Link>
      </form>
    </div>
  );
}
