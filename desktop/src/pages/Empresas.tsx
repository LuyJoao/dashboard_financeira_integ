import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mensagemErro } from "../api/client";
import { criarEmpresa, listarEmpresas } from "../api/empresas";
import { listarTitulos } from "../api/titulos";
import { useAuth } from "../auth/AuthContext";
import { Cartao } from "../components/Cartao";
import { DataTable } from "../components/DataTable";
import { BarraFiltros, FiltroSelect, FiltroTexto } from "../components/Filtros";
import { FormEmpresa } from "../components/FormEmpresa";
import { Modal } from "../components/Modal";
import { btnCls } from "../components/ui";
import { useFiltros } from "../hooks/useFiltros";
import { LinhaEmpresa, linhasDeEmpresas, ROTULO_TIPO_EMPRESA } from "../lib/empresas";
import { formatBRL } from "../lib/format";

const textoErro = (e: unknown) => mensagemErro(e, e instanceof Error ? e.message : undefined);
const TIPOS: Record<string, string> = { Incubada: "incubada", Fornecedor: "fornecedor" };

const colunas: ColumnDef<LinhaEmpresa>[] = [
  {
    accessorKey: "nome",
    header: "Empresa",
    cell: (i) => (
      <Link to={`/empresas/${i.row.original.id}`} className="font-medium hover:underline">
        {i.getValue<string>()}
      </Link>
    ),
  },
  {
    accessorKey: "tipo",
    header: "Tipo",
    cell: (i) => {
      const t = i.getValue<LinhaEmpresa["tipo"]>();
      return (
        <span className={`rounded-full px-2 py-0.5 text-xs ${t === "incubada" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
          {ROTULO_TIPO_EMPRESA[t]}
        </span>
      );
    },
  },
  { accessorKey: "cnpj", header: "CNPJ", cell: (i) => i.getValue<string | null>() ?? "—" },
  { accessorKey: "aPagar", header: "A pagar em aberto", meta: { align: "right" }, cell: (i) => formatBRL(i.getValue<number>()) },
  { accessorKey: "aReceber", header: "A receber em aberto", meta: { align: "right" }, cell: (i) => formatBRL(i.getValue<number>()) },
  {
    accessorKey: "vencidosValor",
    header: "Em atraso",
    meta: { align: "right" },
    cell: (i) => {
      const e = i.row.original;
      return e.vencidosQtd > 0 ? (
        <span className="text-red-700">
          {formatBRL(e.vencidosValor)} ({e.vencidosQtd})
        </span>
      ) : (
        "—"
      );
    },
  },
  {
    id: "detalhe",
    header: "",
    enableSorting: false,
    cell: (i) => (
      <div className="text-right">
        <Link to={`/empresas/${i.row.original.id}`} className="text-sm text-slate-600 hover:text-slate-900">
          Ver detalhes
        </Link>
      </div>
    ),
  },
];

export default function Empresas() {
  const f = useFiltros();
  const qc = useQueryClient();
  const { user } = useAuth();
  const ehAdmin = user?.role === "admin";

  const empresasQ = useQuery({ queryKey: ["empresas"], queryFn: listarEmpresas });
  const titulosQ = useQuery({ queryKey: ["titulos", ""], queryFn: () => listarTitulos(""), retry: false });
  const [novaEmpresa, setNovaEmpresa] = useState(false);

  const cadastrar = useMutation({
    mutationFn: criarEmpresa,
    onSuccess: () => {
      setNovaEmpresa(false);
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });

  const tipo = f.get("tipo");
  const soAtraso = f.get("atraso") === "1";
  const busca = f.get("busca").toLowerCase();

  const linhas = useMemo(
    () => linhasDeEmpresas(empresasQ.data ?? [], titulosQ.data ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
    [empresasQ.data, titulosQ.data]
  );
  const filtradas = useMemo(
    () =>
      linhas.filter(
        (e) =>
          (!tipo || e.tipo === TIPOS[tipo]) &&
          (!soAtraso || e.vencidosQtd > 0) &&
          (!busca || `${e.nome} ${e.cnpj ?? ""}`.toLowerCase().includes(busca))
      ),
    [linhas, tipo, soAtraso, busca]
  );

  const incubadas = linhas.filter((e) => e.tipo === "incubada").length;
  const comAtraso = linhas.filter((e) => e.vencidosQtd > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Empresas</h1>
        {ehAdmin && (
          <button
            className={btnCls}
            onClick={() => {
              cadastrar.reset();
              setNovaEmpresa(true);
            }}
          >
            + Nova empresa
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao titulo="Empresas cadastradas" valor={linhas.length} />
        <Cartao titulo="Incubadas" valor={incubadas} />
        <Cartao titulo="Fornecedores" valor={linhas.length - incubadas} />
        <Cartao titulo="Com títulos em atraso" valor={comAtraso} destaque={comAtraso > 0 ? "erro" : undefined} />
      </div>

      <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
        <FiltroSelect label="Tipo" valor={tipo} onChange={(v) => f.set("tipo", v)} opcoes={Object.keys(TIPOS)} />
        <FiltroTexto label="Buscar" valor={f.get("busca")} onChange={(v) => f.set("busca", v)} placeholder="Nome ou CNPJ" />
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={soAtraso} onChange={(e) => f.set("atraso", e.target.checked ? "1" : "")} />
          Só com atraso
        </label>
      </BarraFiltros>

      <DataTable
        columns={colunas}
        data={filtradas}
        isLoading={empresasQ.isLoading || titulosQ.isLoading}
        error={empresasQ.error ?? titulosQ.error}
        onRetry={() => {
          empresasQ.refetch();
          titulosQ.refetch();
        }}
        vazio={tipo || soAtraso || busca ? "Nenhuma empresa com esses filtros." : "Nenhuma empresa cadastrada ainda."}
      />

      {novaEmpresa && (
        <Modal titulo="Nova empresa" onFechar={() => !cadastrar.isPending && setNovaEmpresa(false)}>
          <FormEmpresa
            enviando={cadastrar.isPending}
            erroServidor={cadastrar.isError ? textoErro(cadastrar.error) : undefined}
            onSalvar={(dados) => cadastrar.mutate(dados)}
            onCancelar={() => setNovaEmpresa(false)}
          />
        </Modal>
      )}
    </div>
  );
}
