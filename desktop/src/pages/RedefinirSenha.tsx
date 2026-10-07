import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, mensagemErro } from "../api/client";
import { btnCls, inputCls } from "../components/ui";

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [erro, setErro] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await api.post("/api/auth/redefinir-senha", { codigo, nova_senha: novaSenha });
      navigate("/login");
    } catch (err) {
      setErro(mensagemErro(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Definir nova senha</h1>
        <input className={inputCls} placeholder="Código recebido por e-mail" value={codigo}
          onChange={(e) => setCodigo(e.target.value)} required />
        <input className={inputCls} type="password" placeholder="Nova senha (mínimo 8 caracteres)" minLength={8}
          value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnCls} w-full`}>Salvar nova senha</button>
        <Link to="/login" className="block text-center text-sm text-slate-500 hover:text-slate-900">
          Voltar para o login
        </Link>
      </form>
    </div>
  );
}
