import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useMemo, useState } from "react";
import { mensagemErro } from "../api/client";
import { atualizarUsuario, criarUsuario, listarUsuarios, Perfil, redefinirSenhaUsuario, Usuario, UsuarioNovo } from "../api/usuarios";
import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { btnCls, inputCls } from "../components/ui";

const textoErro = (e: unknown) => mensagemErro(e, e instanceof Error ? e.message : undefined);
const vazio: UsuarioNovo = { nome: "", email: "", senha: "", role: "user" };
const rotulo = "mb-1 block text-xs text-slate-500";
const PERFIL = { admin: "Administrador", user: "Usuário" } as const;

function FormEdicao({ u, ehVoce, enviando, erro, onSalvar, onCancelar }: {
  u: Usuario; ehVoce: boolean; enviando: boolean; erro?: string; onSalvar: (nome: string, role: Perfil) => void; onCancelar: () => void;
}) {
  const [nome, setNome] = useState(u.nome);
  const [role, setRole] = useState<Perfil>(u.role);
  const [msg, setMsg] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) return setMsg("O nome deve ter pelo menos 2 letras.");
    setMsg("");
    onSalvar(nome.trim(), role);
  }
  return (
    <form onSubmit={enviar} className="space-y-3">
      <label className="block">
        <span className={rotulo}>Nome</span>
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="block">
        <span className={rotulo}>Perfil</span>
        <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Perfil)} disabled={ehVoce}>
          <option value="user">Usuário</option>
          <option value="admin">Administrador</option>
        </select>
        {ehVoce && <span className="mt-1 block text-xs text-slate-500">Você não pode mudar o seu próprio perfil.</span>}
      </label>
      <p className="text-xs text-slate-500">E-mail: {u.email} (não pode ser alterado)</p>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className={btnCls} disabled={enviando}>{enviando ? "Salvando..." : "Salvar"}</button>
      </div>
    </form>
  );
}

function FormSenha({ u, enviando, erro, onSalvar, onCancelar }: {
  u: Usuario; enviando: boolean; erro?: string; onSalvar: (senha: string) => void; onCancelar: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setMsg("A senha deve ter pelo menos 8 caracteres.");
    if (senha !== conf) return setMsg("As senhas não conferem.");
    setMsg("");
    onSalvar(senha);
  }
  return (
    <form onSubmit={enviar} className="space-y-3">
      <p className="text-sm text-slate-600">Nova senha para <strong>{u.nome}</strong>. Passe-a à pessoa por um canal seguro.</p>
      <input className={inputCls} type="password" placeholder="Nova senha (mínimo 8 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
      <input className={inputCls} type="password" placeholder="Repita a senha" value={conf} onChange={(e) => setConf(e.target.value)} />
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className={btnCls} disabled={enviando}>{enviando ? "Salvando..." : "Redefinir senha"}</button>
      </div>
    </form>
  );
}

export default function Usuarios() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState(vazio);
  const [erroCriar, setErroCriar] = useState("");
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState<Usuario | null>(null);

  const lista = useQuery({ queryKey: ["usuarios"], queryFn: listarUsuarios });
  const recarregar = () => qc.invalidateQueries({ queryKey: ["usuarios"] });

  const criar = useMutation({
    mutationFn: () => criarUsuario(form),
    onSuccess: () => { setForm(vazio); setErroCriar(""); recarregar(); },
    onError: (e) => setErroCriar(textoErro(e)),
  });
  const atualizar = useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: { nome?: string; role?: Perfil; ativo?: boolean } }) => atualizarUsuario(id, dados),
    onSuccess: () => { setEditando(null); setMudandoStatus(null); recarregar(); },
  });
  const trocarSenha = useMutation({
    mutationFn: ({ id, senha }: { id: number; senha: string }) => redefinirSenhaUsuario(id, senha),
    onSuccess: () => setSenhaDe(null),
  });

  const euMesmo = (u: Usuario) => u.email.toLowerCase() === (user?.email ?? "").toLowerCase();

  const colunas = useMemo<ColumnDef<Usuario>[]>(
    () => [
      { accessorKey: "nome", header: "Nome", cell: (i) => <span>{i.getValue<string>()}{euMesmo(i.row.original) && <span className="ml-2 text-xs text-slate-400">(você)</span>}</span> },
      { accessorKey: "email", header: "E-mail" },
      { accessorKey: "role", header: "Perfil", cell: (i) => PERFIL[i.getValue<Perfil>()] },
      {
        accessorKey: "ativo",
        header: "Status",
        cell: (i) => i.getValue<boolean>()
          ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Ativo</span>
          : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Inativo</span>,
      },
      {
        id: "acoes",
        header: "",
        enableSorting: false,
        cell: (i) => {
          const u = i.row.original;
          const voce = euMesmo(u);
          return (
            <div className="flex justify-end gap-3 whitespace-nowrap text-sm">
              <button className="text-slate-600 hover:text-slate-900" onClick={() => { atualizar.reset(); setEditando(u); }}>Editar</button>
              <button className="text-slate-600 hover:text-slate-900" onClick={() => { trocarSenha.reset(); setSenhaDe(u); }}>Redefinir senha</button>
              <button
                className={`${u.ativo ? "text-red-600 hover:text-red-800" : "text-green-700 hover:text-green-900"} disabled:cursor-not-allowed disabled:opacity-40`}
                disabled={voce}
                title={voce ? "Você não pode desativar a si mesmo" : ""}
                onClick={() => { atualizar.reset(); setMudandoStatus(u); }}
              >
                {u.ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.email]
  );

  function enviarNovo(e: FormEvent) {
    e.preventDefault();
    criar.mutate();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Usuários</h1>

      <form onSubmit={enviarNovo} className="grid grid-cols-2 gap-3 rounded-xl border bg-white p-4">
        <input className={inputCls} placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
        <input className={inputCls} type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className={inputCls} type="password" placeholder="Senha inicial (mín. 8)" minLength={8} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
        <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Perfil })}>
          <option value="user">Usuário</option>
          <option value="admin">Administrador</option>
        </select>
        {erroCriar && <p className="col-span-2 text-sm text-red-600">{erroCriar}</p>}
        <button className={`${btnCls} col-span-2`} disabled={criar.isPending}>Cadastrar usuário</button>
      </form>

      <DataTable
        columns={colunas}
        data={lista.data ?? []}
        isLoading={lista.isLoading}
        error={lista.error}
        onRetry={() => lista.refetch()}
        vazio="Nenhum usuário cadastrado."
      />

      {editando && (
        <Modal titulo="Editar usuário" onFechar={() => !atualizar.isPending && setEditando(null)}>
          <FormEdicao
            u={editando}
            ehVoce={euMesmo(editando)}
            enviando={atualizar.isPending}
            erro={atualizar.isError ? textoErro(atualizar.error) : undefined}
            onSalvar={(nome, role) => atualizar.mutate({ id: editando.id, dados: { nome, role } })}
            onCancelar={() => setEditando(null)}
          />
        </Modal>
      )}

      {senhaDe && (
        <Modal titulo="Redefinir senha" onFechar={() => !trocarSenha.isPending && setSenhaDe(null)}>
          <FormSenha
            u={senhaDe}
            enviando={trocarSenha.isPending}
            erro={trocarSenha.isError ? textoErro(trocarSenha.error) : undefined}
            onSalvar={(senha) => trocarSenha.mutate({ id: senhaDe.id, senha })}
            onCancelar={() => setSenhaDe(null)}
          />
        </Modal>
      )}

      {mudandoStatus && (
        <Modal titulo={mudandoStatus.ativo ? "Desativar usuário?" : "Reativar usuário?"} onFechar={() => !atualizar.isPending && setMudandoStatus(null)}>
          <div className="space-y-3 text-sm">
            <p>
              {mudandoStatus.ativo
                ? <>Quem estiver desativado não consegue mais entrar no sistema. <strong>{mudandoStatus.nome}</strong> será desativado.</>
                : <><strong>{mudandoStatus.nome}</strong> poderá entrar no sistema de novo.</>}
            </p>
            {atualizar.isError && <p className="text-red-600">{textoErro(atualizar.error)}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button className="rounded-md border px-4 py-2 hover:bg-slate-50" onClick={() => setMudandoStatus(null)} disabled={atualizar.isPending}>Cancelar</button>
              <button
                className={`${btnCls} ${mudandoStatus.ativo ? "bg-red-700 hover:bg-red-800" : ""}`}
                onClick={() => atualizar.mutate({ id: mudandoStatus.id, dados: { ativo: !mudandoStatus.ativo } })}
                disabled={atualizar.isPending}
              >
                {atualizar.isPending ? "Salvando..." : mudandoStatus.ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
