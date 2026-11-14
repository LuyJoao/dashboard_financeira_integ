import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useMemo, useState } from "react";
import { mensagemErro } from "../api/client";
import { atualizarCategoria, Categoria, criarCategoria, excluirCategoria, listarCategorias } from "../api/categorias";
import { DataTable } from "../components/DataTable";
import { BarraFiltros, FiltroTexto } from "../components/Filtros";
import { Modal } from "../components/Modal";
import { btnCls, inputCls } from "../components/ui";
import { useFiltros } from "../hooks/useFiltros";

const textoErro = (e: unknown) => mensagemErro(e, e instanceof Error ? e.message : undefined);

function FormNome({ inicial, rotulo, enviando, erroServidor, outras, onSalvar, onCancelar }: {
  inicial: string; rotulo: string; enviando: boolean; erroServidor?: string; outras: string[];
  onSalvar: (nome: string) => void; onCancelar: () => void;
}) {
  const [nome, setNome] = useState(inicial);
  const [erro, setErro] = useState("");

  function enviar(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (!n) return setErro("Informe o nome da categoria.");
    if (n.length > 60) return setErro("O nome pode ter no máximo 60 caracteres.");
    if (outras.some((o) => o.trim().toLowerCase() === n.toLowerCase())) return setErro("Já existe uma categoria com esse nome.");
    setErro("");
    onSalvar(n);
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">Nome</span>
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {erroServidor && <p className="text-sm text-red-600">{erroServidor}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className={btnCls} disabled={enviando}>
          {enviando ? "Salvando..." : rotulo}
        </button>
      </div>
    </form>
  );
}

export default function Categorias() {
  const f = useFiltros();
  const qc = useQueryClient();
  const consulta = useQuery({ queryKey: ["categorias"], queryFn: listarCategorias });
  const [criando, setCriando] = useState(false);
  const [renomeando, setRenomeando] = useState<Categoria | null>(null);
  const [excluindo, setExcluindo] = useState<Categoria | null>(null);

  const atualizarTelas = (mudouLancamentos: boolean) => {
    qc.invalidateQueries({ queryKey: ["categorias"] });
    if (mudouLancamentos) {
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };
  const criar = useMutation({
    mutationFn: criarCategoria,
    onSuccess: () => { setCriando(false); atualizarTelas(false); },
  });
  const renomear = useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) => atualizarCategoria(id, nome),
    onSuccess: () => { setRenomeando(null); atualizarTelas(true); },
  });
  const excluir = useMutation({
    mutationFn: (id: number) => excluirCategoria(id),
    onSuccess: () => { setExcluindo(null); atualizarTelas(false); },
  });

  const busca = f.get("busca").toLowerCase();
  const todas = consulta.data ?? [];
  const filtradas = useMemo(() => todas.filter((c) => !busca || c.nome.toLowerCase().includes(busca)), [todas, busca]);

  const colunas = useMemo<ColumnDef<Categoria>[]>(
    () => [
      {
        accessorKey: "nome",
        header: "Categoria",
        cell: (i) => (
          <span>
            {i.getValue<string>()}
            {i.row.original.sistema && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">do sistema</span>}
          </span>
        ),
      },
      { accessorKey: "em_uso", header: "Lançamentos", meta: { align: "right" } },
      {
        id: "acoes",
        header: "",
        enableSorting: false,
        cell: (i) => {
          const c = i.row.original;
          const podeExcluir = !c.sistema && c.em_uso === 0;
          return (
            <div className="flex justify-end gap-3 text-sm">
              <button
                className="text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={c.sistema}
                title={c.sistema ? "A categoria do sistema não pode ser renomeada" : ""}
                onClick={() => { renomear.reset(); setRenomeando(c); }}
              >
                Renomear
              </button>
              <button
                className="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!podeExcluir}
                title={c.sistema ? "A categoria do sistema não pode ser excluída" : c.em_uso > 0 ? "Está em uso por lançamentos" : ""}
                onClick={() => { excluir.reset(); setExcluindo(c); }}
              >
                Excluir
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categorias</h1>
        <button className={btnCls} onClick={() => { criar.reset(); setCriando(true); }}>
          + Nova categoria
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Só o administrador cria e altera categorias. "Aplicação Financeira" é do sistema: é ela que separa aplicações, resgates e rendimentos nos cálculos.
      </p>

      <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
        <FiltroTexto label="Buscar" valor={f.get("busca")} onChange={(v) => f.set("busca", v)} placeholder="Nome da categoria" />
      </BarraFiltros>

      <DataTable
        columns={colunas}
        data={filtradas}
        isLoading={consulta.isLoading}
        error={consulta.error}
        onRetry={() => consulta.refetch()}
        vazio={busca ? "Nenhuma categoria com esse nome." : "Nenhuma categoria cadastrada."}
        pageSize={25}
      />

      {criando && (
        <Modal titulo="Nova categoria" onFechar={() => !criar.isPending && setCriando(false)}>
          <FormNome
            inicial=""
            rotulo="Criar categoria"
            enviando={criar.isPending}
            erroServidor={criar.isError ? textoErro(criar.error) : undefined}
            outras={todas.map((c) => c.nome)}
            onSalvar={(nome) => criar.mutate(nome)}
            onCancelar={() => setCriando(false)}
          />
        </Modal>
      )}

      {renomeando && (
        <Modal titulo="Renomear categoria" onFechar={() => !renomear.isPending && setRenomeando(null)}>
          <p className="mb-3 text-sm text-slate-500">
            O novo nome vale para os {renomeando.em_uso} lançamento(s) que usam esta categoria.
          </p>
          <FormNome
            inicial={renomeando.nome}
            rotulo="Salvar"
            enviando={renomear.isPending}
            erroServidor={renomear.isError ? textoErro(renomear.error) : undefined}
            outras={todas.filter((c) => c.id !== renomeando.id).map((c) => c.nome)}
            onSalvar={(nome) => renomear.mutate({ id: renomeando.id, nome })}
            onCancelar={() => setRenomeando(null)}
          />
        </Modal>
      )}

      {excluindo && (
        <Modal titulo="Excluir categoria?" onFechar={() => !excluir.isPending && setExcluindo(null)}>
          <div className="space-y-3 text-sm">
            <p>
              A categoria <strong>{excluindo.nome}</strong> será excluída.
            </p>
            {excluir.isError && <p className="text-red-600">{textoErro(excluir.error)}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button className="rounded-md border px-4 py-2 hover:bg-slate-50" onClick={() => setExcluindo(null)} disabled={excluir.isPending}>
                Cancelar
              </button>
              <button className={`${btnCls} bg-red-700 hover:bg-red-800`} onClick={() => excluir.mutate(excluindo.id)} disabled={excluir.isPending}>
                {excluir.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
