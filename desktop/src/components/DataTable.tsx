import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { Carregando, ErroMsg, Vazio } from "./estados";

type Props<T> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  vazio?: string;
  pageSize?: number;
};

// Tabela genérica: ordenação por clique no cabeçalho, paginação e os 3 estados (carregando, erro, vazio).
// Ordenação e paginação são feitas no navegador; com muitos dados, passam a ser feitas na API.
export function DataTable<T>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  vazio = "Nenhum registro encontrado.",
  pageSize = 10,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  if (isLoading) return <Carregando />;
  if (error) return <ErroMsg erro={error} onRetry={onRetry} />;
  if (data.length === 0) return <Vazio texto={vazio} />;

  const { pageIndex } = table.getState().pagination;

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  const direita = h.column.columnDef.meta?.align === "right";
                  return (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className={`cursor-pointer select-none whitespace-nowrap p-3 font-medium ${direita ? "text-right" : ""}`}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <span className="ml-1 text-xs text-slate-400">{dir === "asc" ? "▲" : dir === "desc" ? "▼" : ""}</span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`p-3 ${cell.column.columnDef.meta?.align === "right" ? "text-right tabular-nums" : ""}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t p-3 text-sm text-slate-600">
        <span>
          {data.length} registro(s) · página {pageIndex + 1} de {table.getPageCount()}
        </span>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border px-2 py-1"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>
          <button
            className="rounded-md border px-3 py-1 disabled:opacity-40"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </button>
          <button
            className="rounded-md border px-3 py-1 disabled:opacity-40"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
