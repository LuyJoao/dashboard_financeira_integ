import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { ErroLinha } from "../../api/importacoes";
import type { LancamentoEdicao } from "../../api/lancamentos";
import { DataTable } from "../DataTable";

type Props = {
  erros: ErroLinha[];
  correcoes: Record<number, LancamentoEdicao>;
  onCorrigir: (erro: ErroLinha) => void;
};

export function TabelaErros({ erros, correcoes, onCorrigir }: Props) {
  const colunas = useMemo<ColumnDef<ErroLinha>[]>(
    () => [
      { accessorKey: "linha", header: "Linha" },
      { accessorKey: "coluna", header: "Coluna" },
      { accessorKey: "mensagem", header: "Problema" },
      {
        id: "situacao",
        header: "Situação",
        enableSorting: false,
        cell: (i) =>
          correcoes[i.row.original.linha] ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Corrigida</span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Com erro</span>
          ),
      },
      {
        id: "acao",
        header: "",
        enableSorting: false,
        cell: (i) => (
          <div className="text-right">
            <button className="text-sm text-slate-600 hover:text-slate-900" onClick={() => onCorrigir(i.row.original)}>
              {correcoes[i.row.original.linha] ? "Editar correção" : "Corrigir"}
            </button>
          </div>
        ),
      },
    ],
    [correcoes, onCorrigir]
  );

  return <DataTable columns={colunas} data={erros} pageSize={10} />;
}
