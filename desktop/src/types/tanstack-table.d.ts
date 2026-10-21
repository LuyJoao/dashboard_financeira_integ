import "@tanstack/react-table";

// Permite usar meta: { align: "right" } nas colunas.
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right";
  }
}
