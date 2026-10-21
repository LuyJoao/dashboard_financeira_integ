import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../components/DataTable";
import { BarraFiltros, FiltroData, FiltroSelect, FiltroTexto } from "../components/Filtros";
import { useFiltros } from "../hooks/useFiltros";
import { formatBRL, formatData } from "../lib/format";
import { buscarLancamentos, Lancamento } from "../mock/lancamentos";

const colunas: ColumnDef<Lancamento>[] = [
  { accessorKey: "data", header: "Data", cell: (i) => formatData(i.getValue<string>()) },
  { accessorKey: "banco", header: "Banco" },
  { accessorKey: "categoria", header: "Categoria" },
  { accessorKey: "descricao", header: "Descrição" },
  {
    accessorKey: "valor",
    header: "Valor",
    meta: { align: "right" },
    cell: (i) => {
      const v = i.getValue<number>();
      return <span className={v < 0 ? "text-red-700" : "text-green-700"}>{formatBRL(v)}</span>;
    },
  },
];

export default function Lancamentos() {
  const f = useFiltros();
  const simular = f.get("simular");

  const consulta = useQuery({
    queryKey: ["lancamentos", simular],
    queryFn: () => buscarLancamentos(simular),
    retry: false, // para o estado de erro aparecer na hora durante os testes
  });

  const banco = f.get("banco");
  const categoria = f.get("categoria");
  const de = f.get("de");
  const ate = f.get("ate");
  const busca = f.get("busca").toLowerCase();

  const todos = consulta.data ?? [];
  const categorias = useMemo(() => Array.from(new Set(todos.map((l) => l.categoria))).sort(), [todos]);

  // Filtro no navegador (dados falsos). Com a API, estes mesmos valores viram parâmetros da consulta.
  const filtrados = useMemo(
    () =>
      todos.filter(
        (l) =>
          (!banco || l.banco === banco) &&
          (!categoria || l.categoria === categoria) &&
          (!de || l.data >= de) &&
          (!ate || l.data <= ate) &&
          (!busca || l.descricao.toLowerCase().includes(busca))
      ),
    [todos, banco, categoria, de, ate, busca]
  );

  const filtrosAtivos = [banco, categoria, de, ate, busca].some(Boolean);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Lançamentos</h1>

      <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
        <FiltroSelect label="Banco" valor={banco} onChange={(v) => f.set("banco", v)} opcoes={["Caixa", "Unicred", "Itaú"]} />
        <FiltroSelect label="Categoria" valor={categoria} onChange={(v) => f.set("categoria", v)} opcoes={categorias} />
        <FiltroData label="De" valor={de} onChange={(v) => f.set("de", v)} />
        <FiltroData label="Até" valor={ate} onChange={(v) => f.set("ate", v)} />
        <FiltroTexto label="Buscar descrição" valor={f.get("busca")} onChange={(v) => f.set("busca", v)} placeholder="Digite..." />
      </BarraFiltros>

      <DataTable
        columns={colunas}
        data={filtrados}
        isLoading={consulta.isLoading}
        error={consulta.error}
        onRetry={() => consulta.refetch()}
        vazio={filtrosAtivos ? "Nenhum lançamento com esses filtros." : "Nenhum lançamento importado ainda."}
      />
    </div>
  );
}
