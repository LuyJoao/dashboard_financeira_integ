import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { api, mensagemErro } from "../api/client";
import { btnCls, inputCls } from "../components/ui";

type Usuario = { id: number; nome: string; email: string; role: string; ativo: boolean };
const vazio = { nome: "", email: "", senha: "", role: "user" };

export default function Usuarios() {
  const qc = useQueryClient();
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState("");

  const lista = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => api.get<Usuario[]>("/api/usuarios").then((r) => r.data),
  });

  const criar = useMutation({
    mutationFn: () => api.post("/api/usuarios", form),
    onSuccess: () => {
      setForm(vazio);
      setErro("");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    criar.mutate();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Usuários</h1>

      <form onSubmit={enviar} className="grid grid-cols-2 gap-3 rounded-xl border bg-white p-4">
        <input className={inputCls} placeholder="Nome" value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
        <input className={inputCls} type="email" placeholder="E-mail" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className={inputCls} type="password" placeholder="Senha inicial (mín. 8)" minLength={8} value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
        <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="user">Usuário</option>
          <option value="admin">Administrador</option>
        </select>
        {erro && <p className="col-span-2 text-sm text-red-600">{erro}</p>}
        <button className={`${btnCls} col-span-2`} disabled={criar.isPending}>Cadastrar usuário</button>
      </form>

      <table className="w-full rounded-xl border bg-white text-left text-sm">
        <thead className="border-b text-slate-500">
          <tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Perfil</th></tr>
        </thead>
        <tbody>
          {lista.data?.map((u) => (
            <tr key={u.id} className="border-b last:border-0">
              <td className="p-3">{u.nome}</td>
              <td className="p-3">{u.email}</td>
              <td className="p-3">{u.role === "admin" ? "Administrador" : "Usuário"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
