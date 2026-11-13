import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { listarEmpresas } from "../api/empresas";
import { listarTitulos, Titulo } from "../api/titulos";
import { Cartao } from "../components/Cartao";
import { DataTable } from "../components/DataTable";
import { Carregando, ErroMsg, Vazio } from "../components/estados";
import { SeloStatus } from "../components/SeloStatus";
import { btnCls } from "../components/ui";
import { resumoPorEmpresa, ROTULO_TIPO_EMPRESA } from "../lib/empresas";
import { formatBRL, formatData } from "../lib/format";
import { ROTULO_STATUS, statusDoTitulo } from "../lib/titulos";

// Somente leitura: para lançar, editar ou marcar como pago, use a tela de Contas (o botão abaixo já abre filtrada nesta empresa).
const colunas: ColumnDef<Titulo>[] = [
  { accessorKey: "vencimento", header: "Vencimento", cell: (i) => formatData(i.getValue<string>()) },
  { accessorKey: "tipo", header: "Tipo", cell: (i) => (i.getValue<string>() === "pagar" ? "A pagar" : "A receber") },
  { id: "documento", header: "Documento", accessorFn: (t) => `${t.forma} ${t.numero}` },
  { accessorKey: "descricao", header: "Descrição" },
  {
    accessorKey: "valor",
    header: "Valor",
    meta: { align: "right" },
    cell: (i) => <span className={i.row.original.tipo === "pagar" ? "text-red-700" : "text-green-700"}>{formatBRL(i.getValue<number>())}</span>,
  },
  { id: "status", header: "Status", accessorFn: (t) => ROTULO_STATUS[statusDoTitulo(t)], cell: (i) => <SeloStatus titulo={i.row.original} /> },
  { accessorKey: "pago_em", header: "Pago em", cell: (i) => formatData(i.getValue<string | null>()) },
];

export default function EmpresaDetalhe() {
  const { id } = useParams();
  const idNum = Number(id);
  const empresasQ = useQuery({ queryKey: ["empresas"], queryFn: listarEmpresas });
  const titulosQ = useQuery({ queryKey: ["titulos", ""], queryFn: () => listarTitulos(""), retry: false });

  const empresa = empresasQ.data?.find((e) => e.id === idNum);
  const titulos = useMemo(
    () =>
      (titulosQ.data ?? [])
        .filter((t) => t.empresa_id === idNum)
        .sort((a, b) => Number(!!a.pago_em) - Number(!!b.pago_em) || b.vencimento.localeCompare(a.vencimento)),
    [titulosQ.data, idNum]
  );
  const resumo = useMemo(() => resumoPorEmpresa(titulos).get(idNum), [titulos, idNum]);

  const voltar = (
    <Link to="/empresas" className="text-sm text-slate-500 hover:text-slate-900">
      ← Voltar para Empresas
    </Link>
  );

  if (empresasQ.isLoading || titulosQ.isLoading) return <Carregando texto="Carregando a empresa..." />;
  if (empresasQ.error || titulosQ.error) {
    return <ErroMsg erro={empresasQ.error ?? titulosQ.error} onRetry={() => { empresasQ.refetch(); titulosQ.refetch(); }} />;
  }
  if (!empresa) {
    return (
      <div className="space-y-4">
        {voltar}
        <Vazio texto="Empresa não encontrada." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {voltar}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{empresa.nome}</h1>
          <p className="text-sm text-slate-500">
            {ROTULO_TIPO_EMPRESA[empresa.tipo]} · CNPJ: {empresa.cnpj ?? "não informado"}
          </p>
        </div>
        <Link to={`/contas?empresa=${encodeURIComponent(empresa.nome)}`} className={btnCls}>
          Gerenciar na tela de Contas
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao titulo="A pagar em aberto" valor={formatBRL(resumo?.aPagar ?? 0)} />
        <Cartao titulo="A receber em aberto" valor={formatBRL(resumo?.aReceber ?? 0)} />
        <Cartao
          titulo={`Em atraso (${resumo?.vencidosQtd ?? 0})`}
          valor={formatBRL(resumo?.vencidosValor ?? 0)}
          destaque={(resumo?.vencidosQtd ?? 0) > 0 ? "erro" : undefined}
        />
        <Cartao titulo="Títulos no total" valor={resumo?.totalTitulos ?? 0} />
      </div>

      <h2 className="text-sm font-medium">Títulos desta empresa</h2>
      <DataTable columns={colunas} data={titulos} vazio="Nenhuma NF ou boleto lançado para esta empresa." />
    </div>
  );
}
