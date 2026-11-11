import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { atualizarLancamento, excluirLancamento, Lancamento, LancamentoEdicao, listarLancamentos } from "../api/lancamentos";
import { mensagemErro } from "../api/client";
import { DataTable } from "../components/DataTable";
import { BarraFiltros, FiltroData, FiltroSelect, FiltroTexto } from "../components/Filtros";
import { FormLancamento } from "../components/FormLancamento";
import { Modal } from "../components/Modal";
import { btnCls } from "../components/ui";
import { useFiltros } from "../hooks/useFiltros";
import { formatBRL, formatData } from "../lib/format";
import { validar } from "../lib/lancamentos";

const semId = ({ id: _id, ...resto }: Lancamento): LancamentoEdicao => resto;
const inconsistente = (l: Lancamento) => validar(semId(l)).length > 0;

export default function Lancamentos() {
  const f = useFiltros();
  const qc = useQueryClient();
  const simular = f.get("simular");

  const consulta = useQuery({
    queryKey: ["lancamentos", simular],
    queryFn: () => listarLancamentos(simular),
    retry: false, // para o estado de erro aparecer na hora durante os testes
  });

  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null);

  // Depois de editar ou excluir, atualiza a lista e o dashboard
  const atualizarTelas = () => {
    qc.invalidateQueries({ queryKey: ["lancamentos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const salvar = useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: LancamentoEdicao }) => atualizarLancamento(id, dados),
    onSuccess: () => {
      setEditando(null);
      atualizarTelas();
    },
  });
  const excluir = useMutation({
    mutationFn: (id: number) => excluirLancamento(id),
    onSuccess: () => {
      setExcluindo(null);
      atualizarTelas();
    },
  });

  const banco = f.get("banco");
  const categoria = f.get("categoria");
  const tipo = f.get("tipo");
  const de = f.get("de");
  const ate = f.get("ate");
  const busca = f.get("busca").toLowerCase();
  const soInconsistentes = f.get("inconsistentes") === "1";

  const todos = consulta.data ?? [];
  // Provisório: contas e categorias saem dos próprios dados. Depois virão do cadastro (categorias são criadas pelo admin).
  const contas = useMemo(() => Array.from(new Set(todos.map((l) => l.banco))).sort(), [todos]);
  const categorias = useMemo(() => Array.from(new Set(todos.map((l) => l.categoria))).sort(), [todos]);
  const qtdInconsistentes = useMemo(() => todos.filter(inconsistente).length, [todos]);

  const filtrados = useMemo(
    () =>
      todos.filter(
        (l) =>
          (!banco || l.banco === banco) &&
          (!categoria || l.categoria === categoria) &&
          (!tipo || l.tipo === tipo) &&
          (!de || l.data >= de) &&
          (!ate || l.data <= ate) &&
          (!busca || l.descricao.toLowerCase().includes(busca)) &&
          (!soInconsistentes || inconsistente(l))
      ),
    [todos, banco, categoria, tipo, de, ate, busca, soInconsistentes]
  );

  const colunas = useMemo<ColumnDef<Lancamento>[]>(
    () => [
      { accessorKey: "data", header: "Data", cell: (i) => formatData(i.getValue<string>()) },
      { accessorKey: "banco", header: "Conta" },
      { accessorKey: "categoria", header: "Categoria" },
      {
        accessorKey: "tipo",
        header: "Tipo",
        cell: (i) => {
          const l = i.row.original;
          const problemas = validar(semId(l));
          return (
            <span>
              {l.tipo}
              {problemas.length > 0 && (
                <span className="ml-1 cursor-help text-amber-600" title={problemas.join("\n")}>
                  ⚠
                </span>
              )}
            </span>
          );
        },
      },
      { accessorKey: "descricao", header: "Descrição" },
      { accessorKey: "observacao", header: "Observação" },
      {
        accessorKey: "valor",
        header: "Valor",
        meta: { align: "right" },
        cell: (i) => {
          const v = i.getValue<number>();
          return <span className={v < 0 ? "text-red-700" : "text-green-700"}>{formatBRL(v)}</span>;
        },
      },
      {
        id: "acoes",
        header: "",
        enableSorting: false,
        cell: (i) => (
          <div className="flex justify-end gap-3 text-sm">
            <button
              className="text-slate-600 hover:text-slate-900"
              onClick={() => {
                salvar.reset();
                setEditando(i.row.original);
              }}
            >
              Editar
            </button>
            <button
              className="text-red-600 hover:text-red-800"
              onClick={() => {
                excluir.reset();
                setExcluindo(i.row.original);
              }}
            >
              Excluir
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const filtrosAtivos = [banco, categoria, tipo, de, ate, busca].some(Boolean) || soInconsistentes;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Lançamentos</h1>

      <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
        <FiltroSelect label="Conta" valor={banco} onChange={(v) => f.set("banco", v)} opcoes={contas} />
        <FiltroSelect label="Categoria" valor={categoria} onChange={(v) => f.set("categoria", v)} opcoes={categorias} />
        <FiltroSelect label="Tipo" valor={tipo} onChange={(v) => f.set("tipo", v)} opcoes={["Receita", "Despesa", "Investimento"]} />
        <FiltroData label="De" valor={de} onChange={(v) => f.set("de", v)} />
        <FiltroData label="Até" valor={ate} onChange={(v) => f.set("ate", v)} />
        <FiltroTexto label="Buscar descrição" valor={f.get("busca")} onChange={(v) => f.set("busca", v)} placeholder="Digite..." />
      </BarraFiltros>

      {qtdInconsistentes > 0 && (
        <label className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" checked={soInconsistentes} onChange={(e) => f.set("inconsistentes", e.target.checked ? "1" : "")} />
          {qtdInconsistentes} lançamento(s) com ⚠ inconsistência. Mostrar só esses para corrigir.
        </label>
      )}

      <DataTable
        columns={colunas}
        data={filtrados}
        isLoading={consulta.isLoading}
        error={consulta.error}
        onRetry={() => consulta.refetch()}
        vazio={filtrosAtivos ? "Nenhum lançamento com esses filtros." : "Nenhum lançamento importado ainda."}
      />

      {editando && (
        <Modal titulo="Editar lançamento" onFechar={() => !salvar.isPending && setEditando(null)}>
          <FormLancamento
            inicial={editando}
            contas={contas}
            categorias={categorias}
            enviando={salvar.isPending}
            erroServidor={salvar.isError ? mensagemErro(salvar.error) : undefined}
            onSalvar={(dados) => salvar.mutate({ id: editando.id, dados })}
            onCancelar={() => setEditando(null)}
          />
        </Modal>
      )}

      {excluindo && (
        <Modal titulo="Excluir lançamento?" onFechar={() => !excluir.isPending && setExcluindo(null)}>
          <div className="space-y-3 text-sm">
            <p>
              {formatData(excluindo.data)} · {excluindo.banco} · {excluindo.categoria}
              <br />
              {excluindo.descricao} — <strong>{formatBRL(excluindo.valor)}</strong>
            </p>
            <p className="text-slate-500">
              Se uma planilha com esta linha for importada de novo, ela volta e será preciso excluí-la outra vez.
            </p>
            {excluir.isError && <p className="text-red-600">{mensagemErro(excluir.error)}</p>}
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
