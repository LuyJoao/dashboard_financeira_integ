import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import {
  confirmarImportacao,
  enviarPrevia,
  ErroLinha,
  Importacao,
  LinhaPrevia,
  listarImportacoes,
  Previa,
} from "../api/importacoes";
import { mensagemErro } from "../api/client";
import { Cartao } from "../components/Cartao";
import { DataTable } from "../components/DataTable";
import { Carregando, ErroMsg } from "../components/estados";
import { UploadArquivo } from "../components/UploadArquivo";
import { btnCls } from "../components/ui";
import { formatBRL, formatData, formatDataHora } from "../lib/format";

// Decisão em aberto com a supervisora: se der erro em algumas linhas, importa só as válidas?
// true  = permite importar as linhas válidas (as com erro são ignoradas)
// false = só permite importar se a planilha não tiver nenhum erro
const PERMITE_IMPORTAR_COM_ERROS = true;

const colAmostra: ColumnDef<LinhaPrevia>[] = [
  { accessorKey: "linha", header: "Linha" },
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

const colErros: ColumnDef<ErroLinha>[] = [
  { accessorKey: "linha", header: "Linha" },
  { accessorKey: "coluna", header: "Coluna" },
  { accessorKey: "mensagem", header: "Problema" },
];

const colHistorico: ColumnDef<Importacao>[] = [
  { accessorKey: "enviado_em", header: "Data e hora", cell: (i) => formatDataHora(i.getValue<string>()) },
  { accessorKey: "arquivo_nome", header: "Arquivo" },
  { accessorKey: "usuario_nome", header: "Enviado por" },
  { accessorKey: "linhas_total", header: "Linhas", meta: { align: "right" } },
  { accessorKey: "linhas_ok", header: "Importadas", meta: { align: "right" } },
  { accessorKey: "linhas_erro", header: "Com erro", meta: { align: "right" } },
  {
    accessorKey: "status",
    header: "Status",
    cell: (i) =>
      i.getValue<string>() === "concluida" ? (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Concluída</span>
      ) : (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Com erros</span>
      ),
  },
];

export default function Importar() {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [concluida, setConcluida] = useState<Importacao | null>(null);

  const gerarPrevia = useMutation({ mutationFn: enviarPrevia, onSuccess: setPrevia });

  const confirmar = useMutation({
    mutationFn: confirmarImportacao,
    onSuccess: (imp) => {
      setConcluida(imp);
      setPrevia(null);
      qc.invalidateQueries({ queryKey: ["importacoes"] });
    },
  });

  const historico = useQuery({ queryKey: ["importacoes"], queryFn: listarImportacoes });

  function escolher(f: File) {
    setArquivo(f);
    setConcluida(null);
    gerarPrevia.mutate(f);
  }

  function recomecar() {
    setArquivo(null);
    setPrevia(null);
    setConcluida(null);
    gerarPrevia.reset();
    confirmar.reset();
  }

  return (
    <div className="max-w-5xl space-y-8">
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Importar planilha Excel</h1>

        {/* Etapa 3: concluída */}
        {concluida && (
          <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-6 text-sm text-green-900">
            <p className="font-medium">Importação concluída: {concluida.arquivo_nome}</p>
            <p>
              {concluida.linhas_ok} linhas importadas
              {concluida.linhas_erro > 0 && `, ${concluida.linhas_erro} ignoradas por erro`}.
            </p>
            <button className={btnCls} onClick={recomecar}>
              Importar outra planilha
            </button>
          </div>
        )}

        {/* Etapa 1: escolher o arquivo */}
        {!concluida && !previa && (
          <>
            <UploadArquivo onArquivo={escolher} disabled={gerarPrevia.isPending} />
            {gerarPrevia.isPending && <Carregando texto="Lendo e validando a planilha..." />}
            {gerarPrevia.isError && (
              <ErroMsg erro={gerarPrevia.error} onRetry={() => arquivo && gerarPrevia.mutate(arquivo)} />
            )}
          </>
        )}

        {/* Etapa 2: prévia */}
        {!concluida && previa && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Arquivo: <span className="font-medium text-slate-900">{previa.arquivo_nome}</span>
              </p>
              <button className="text-sm text-slate-500 hover:text-slate-900" onClick={recomecar}>
                Escolher outro arquivo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Cartao titulo="Linhas lidas" valor={previa.total_linhas} />
              <Cartao titulo="Linhas válidas" valor={previa.linhas_ok} destaque="ok" />
              <Cartao titulo="Linhas com erro" valor={previa.linhas_erro} destaque={previa.linhas_erro ? "erro" : undefined} />
              <Cartao titulo="Meses encontrados" valor={previa.periodos.length} />
            </div>
            <p className="text-xs text-slate-500">Meses: {previa.periodos.join(", ")}</p>

            {previa.linhas_erro > 0 && (
              <div className="space-y-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {PERMITE_IMPORTAR_COM_ERROS
                    ? `${previa.linhas_erro} linha(s) têm problemas e NÃO serão importadas. Corrija na planilha e envie de novo, ou importe só as válidas.`
                    : `${previa.linhas_erro} linha(s) têm problemas. Corrija a planilha e envie de novo.`}
                </div>
                <h2 className="text-sm font-medium">Linhas com erro</h2>
                <DataTable columns={colErros} data={previa.erros} pageSize={10} />
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-medium">Prévia das primeiras linhas válidas</h2>
              <DataTable columns={colAmostra} data={previa.amostra} pageSize={10} />
            </div>

            {confirmar.isError && (
              <p className="text-sm text-red-600">{mensagemErro(confirmar.error)}</p>
            )}

            <div className="flex gap-3">
              <button
                className={btnCls}
                disabled={
                  confirmar.isPending ||
                  previa.linhas_ok === 0 ||
                  (previa.linhas_erro > 0 && !PERMITE_IMPORTAR_COM_ERROS)
                }
                onClick={() => confirmar.mutate(previa.token)}
              >
                {confirmar.isPending
                  ? "Importando..."
                  : previa.linhas_erro > 0
                    ? `Importar ${previa.linhas_ok} linhas válidas`
                    : `Confirmar importação (${previa.linhas_ok} linhas)`}
              </button>
              <button
                className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                onClick={recomecar}
                disabled={confirmar.isPending}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Histórico */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico de importações</h2>
        <DataTable
          columns={colHistorico}
          data={historico.data ?? []}
          isLoading={historico.isLoading}
          error={historico.error}
          onRetry={() => historico.refetch()}
          vazio="Nenhuma planilha foi importada ainda."
        />
      </section>
    </div>
  );
}
