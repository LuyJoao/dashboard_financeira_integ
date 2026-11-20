import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useCallback, useState } from "react";
import {
  confirmarImportacao,
  enviarPrevia,
  ErroLinha,
  Importacao,
  LinhaAtualizada,
  LinhaPrevia,
  listarImportacoes,
  Previa,
} from "../api/importacoes";
import { mensagemErro } from "../api/client";
import type { LancamentoEdicao, Tipo } from "../api/lancamentos";
import { Cartao } from "../components/Cartao";
import { BotoesExportacao } from "../components/BotoesExportacao";
import { DataTable } from "../components/DataTable";
import { Carregando, ErroMsg } from "../components/estados";
import { FormLancamento } from "../components/FormLancamento";
import { TabelaErros } from "../components/importar/TabelaErros";
import { Modal } from "../components/Modal";
import { UploadArquivo } from "../components/UploadArquivo";
import { btnCls } from "../components/ui";
import { formatBRL, formatData, formatDataHora } from "../lib/format";
import { CONTAS_FIXAS } from "../lib/lancamentos";

// Se sobrarem linhas com erro: true = importa as demais e ignora as com erro; false = só importa sem nenhum erro.
const PERMITE_IMPORTAR_COM_ERROS = true;

// Sugestão inicial para corrigir uma linha. O sinal do valor bate com o extrato; o Tipo é o que costuma estar errado.
// Por isso o tipo sugerido vem do sinal.
function brutoParaEdicao(e: ErroLinha): LancamentoEdicao {
  const b = e.bruto;
  const valor = valorBrutoEmCentavos(b.valor);
  const tipo: Tipo = valor > 0 ? "Receita" : b.tipo === "Investimento" ? "Investimento" : "Despesa";
  return {
    data: typeof b.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.data) ? b.data : "",
    banco: CONTAS_FIXAS.includes(String(b.banco)) ? String(b.banco) : CONTAS_FIXAS[0],
    categoria: String(b.categoria),
    tipo,
    descricao: String(b.descricao),
    observacao: String(b.observacao ?? ""),
    valor,
  };
}

function valorBrutoEmCentavos(valor: number | string | null): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
  if (typeof valor !== "string") return 0;
  const texto = valor.trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

const emblema = (cor: string, texto: string) => <span className={`rounded-full px-2 py-0.5 text-xs ${cor}`}>{texto}</span>;

const colAmostra: ColumnDef<LinhaPrevia>[] = [
  { accessorKey: "linha", header: "Linha" },
  {
    accessorKey: "situacao",
    header: "Situação",
    cell: (i) => (i.getValue<string>() === "nova" ? emblema("bg-green-100 text-green-800", "Nova") : emblema("bg-amber-100 text-amber-800", "Atualizada")),
  },
  { accessorKey: "data", header: "Data", cell: (i) => formatData(i.getValue<string>()) },
  { accessorKey: "banco", header: "Conta" },
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

const colAtualizadas: ColumnDef<LinhaAtualizada>[] = [
  { accessorKey: "linha", header: "Linha" },
  { accessorKey: "descricao", header: "Descrição" },
  {
    accessorKey: "mudancas",
    header: "O que muda",
    enableSorting: false,
    cell: (i) => (
      <div>
        {i.getValue<string[]>().map((m) => (
          <div key={m}>{m}</div>
        ))}
      </div>
    ),
  },
];

const colHistorico: ColumnDef<Importacao>[] = [
  { accessorKey: "enviado_em", header: "Data e hora", cell: (i) => formatDataHora(i.getValue<string>()) },
  { accessorKey: "arquivo_nome", header: "Arquivo" },
  { accessorKey: "usuario_nome", header: "Enviado por" },
  { accessorKey: "linhas_total", header: "Linhas", meta: { align: "right" } },
  { accessorKey: "linhas_novas", header: "Novas", meta: { align: "right" } },
  { accessorKey: "linhas_atualizadas", header: "Atualizadas", meta: { align: "right" } },
  { accessorKey: "linhas_erro", header: "Com erro", meta: { align: "right" } },
  {
    accessorKey: "status",
    header: "Status",
    cell: (i) => (i.getValue<string>() === "concluida" ? emblema("bg-green-100 text-green-800", "Concluída") : emblema("bg-amber-100 text-amber-800", "Com erros")),
  },
];

export default function Importar() {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [concluida, setConcluida] = useState<Importacao | null>(null);
  const [correcoes, setCorrecoes] = useState<Record<number, LancamentoEdicao>>({});
  const [corrigindo, setCorrigindo] = useState<ErroLinha | null>(null);

  const gerarPrevia = useMutation({
    mutationFn: enviarPrevia,
    onSuccess: (p) => {
      setPrevia(p);
      setCorrecoes({});
    },
  });

  const confirmar = useMutation({
    mutationFn: confirmarImportacao,
    onSuccess: (imp) => {
      setConcluida(imp);
      setPrevia(null);
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const historico = useQuery({ queryKey: ["importacoes"], queryFn: listarImportacoes });
  const abrirCorrecao = useCallback((e: ErroLinha) => setCorrigindo(e), []);

  const corrigidas = Object.keys(correcoes).length;
  const errosRestantes = previa ? previa.linhas_erro - corrigidas : 0;
  const aImportar = previa ? previa.novas + previa.atualizadas + corrigidas : 0;
  const bloqueado = confirmar.isPending || (errosRestantes > 0 && !PERMITE_IMPORTAR_COM_ERROS);

  function escolher(f: File) {
    setArquivo(f);
    setConcluida(null);
    gerarPrevia.mutate(f);
  }

  function recomecar() {
    setArquivo(null);
    setPrevia(null);
    setConcluida(null);
    setCorrecoes({});
    gerarPrevia.reset();
    confirmar.reset();
  }

  function aoConfirmar() {
    if (!previa) return;
    confirmar.mutate({
      token: previa.token,
      correcoes: Object.entries(correcoes).map(([linha, dados]) => ({ linha: Number(linha), dados })),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">Importar planilha Excel</h1>
          <BotoesExportacao />
        </div>

        {/* Etapa final: concluída */}
        {concluida && (
          <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-6 text-sm text-green-900">
            <p className="font-medium">Importação concluída: {concluida.arquivo_nome}</p>
            <p>
              {concluida.linhas_novas} linhas novas, {concluida.linhas_atualizadas} atualizadas
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
            {gerarPrevia.isError && <ErroMsg erro={gerarPrevia.error} onRetry={() => arquivo && gerarPrevia.mutate(arquivo)} />}
          </>
        )}

        {/* Etapa 2: prévia e correções */}
        {!concluida && previa && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Arquivo: <span className="font-medium text-slate-900">{previa.arquivo_nome}</span> · Meses: {previa.periodos.join(", ")}
              </p>
              <button className="text-sm text-slate-500 hover:text-slate-900" onClick={recomecar}>
                Escolher outro arquivo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <Cartao titulo="Linhas lidas" valor={previa.total_linhas} />
              <Cartao titulo="Novas" valor={previa.novas + corrigidas} destaque="ok" />
              <Cartao titulo="Atualizadas" valor={previa.atualizadas} />
              <Cartao titulo="Iguais (ignoradas)" valor={previa.iguais} />
              <Cartao titulo="Com erro" valor={errosRestantes} destaque={errosRestantes > 0 ? "erro" : undefined} />
            </div>

            {previa.atualizadas > 0 && (
              <div className="space-y-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {previa.atualizadas} linha(s) já existem e são diferentes. Ao confirmar, a planilha <strong>sobrescreve</strong> o que está no sistema,
                  inclusive edições feitas à mão nessas linhas.
                </div>
                <h2 className="text-sm font-medium">Linhas que serão atualizadas</h2>
                <DataTable columns={colAtualizadas} data={previa.atualizadas_detalhe} pageSize={5} />
              </div>
            )}

            {previa.erros.length > 0 && (
              <div className="space-y-2">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  {errosRestantes > 0
                    ? PERMITE_IMPORTAR_COM_ERROS
                      ? `${errosRestantes} linha(s) com erro. Corrija na tela ou elas serão ignoradas.`
                      : `${errosRestantes} linha(s) com erro. Corrija todas para poder confirmar.`
                    : "Todas as linhas com erro foram corrigidas."}
                </div>
                <h2 className="text-sm font-medium">Linhas com erro</h2>
                <TabelaErros erros={previa.erros} correcoes={correcoes} onCorrigir={abrirCorrecao} />
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-medium">Prévia das linhas novas e atualizadas</h2>
              <DataTable columns={colAmostra} data={previa.amostra} pageSize={10} />
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-medium">Saldos lidos do extrato</h2>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2 text-left font-medium">Mês</th>
                      <th className="p-2 text-left font-medium">Conta</th>
                      <th className="p-2 text-right font-medium">Entradas</th>
                      <th className="p-2 text-right font-medium">Saídas</th>
                      <th className="p-2 text-right font-medium">Saldo inicial</th>
                      <th className="p-2 text-right font-medium">Saldo final do extrato</th>
                      <th className="p-2 text-center font-medium">Leitura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.saldos.map((s) => (
                      <tr key={`${s.mes}-${s.conta}`} className="border-b tabular-nums last:border-0">
                        <td className="p-2">{s.mes}</td>
                        <td className="p-2">{s.conta}</td>
                        <td className="p-2 text-right">{formatBRL(s.entradas)}</td>
                        <td className="p-2 text-right">{formatBRL(s.saidas)}</td>
                        <td className="p-2 text-right">{formatBRL(s.saldo_inicial)}</td>
                        <td className="p-2 text-right">{formatBRL(s.saldo_final_informado)}</td>
                        <td className="p-2 text-center">{s.lido_do_extrato ? "Lido" : "Não conferido"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previa.aplicado.length > 0 && (
                <p className="text-xs text-slate-500">
                  Saldo aplicado calculado: {previa.aplicado.map((a) => `${a.mes}: ${formatBRL(a.saldo_final)}`).join(" · ")}
                </p>
              )}
            </div>

            {confirmar.isError && <p className="text-sm text-red-600">{mensagemErro(confirmar.error)}</p>}

            <div className="flex gap-3">
              <button className={btnCls} disabled={bloqueado} onClick={aoConfirmar}>
                {confirmar.isPending
                  ? "Importando..."
                  : errosRestantes > 0
                    ? `Importar ${aImportar} linhas (${errosRestantes} com erro serão ignoradas)`
                    : `Confirmar importação (${aImportar} linhas)`}
              </button>
              <button className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" onClick={recomecar} disabled={confirmar.isPending}>
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

      {corrigindo && previa && (
        <Modal titulo={`Corrigir a linha ${corrigindo.linha}`} onFechar={() => setCorrigindo(null)}>
          <p className="mb-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900">{corrigindo.mensagem}</p>
          <FormLancamento
            inicial={correcoes[corrigindo.linha] ?? brutoParaEdicao(corrigindo)}
            contas={CONTAS_FIXAS}
            categorias={previa.categorias}
            enviando={false}
            nota="A correção vale só para esta importação. Corrija também a planilha se for reutilizá-la."
            onSalvar={(dados) => {
              setCorrecoes((c) => ({ ...c, [corrigindo.linha]: dados }));
              setCorrigindo(null);
            }}
            onCancelar={() => setCorrigindo(null)}
          />
        </Modal>
      )}
    </div>
  );
}
