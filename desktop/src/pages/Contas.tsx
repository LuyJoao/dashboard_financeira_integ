import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { mensagemErro } from "../api/client";
import { criarEmpresa, listarEmpresas } from "../api/empresas";
import { atualizarTitulo, criarTitulo, excluirTitulo, listarTitulos, Titulo, TituloEdicao } from "../api/titulos";
import { useAuth } from "../auth/AuthContext";
import { Cartao } from "../components/Cartao";
import { DataTable } from "../components/DataTable";
import { BarraFiltros, FiltroData, FiltroSelect, FiltroTexto } from "../components/Filtros";
import { FormEmpresa } from "../components/FormEmpresa";
import { FormTitulo } from "../components/FormTitulo";
import { Modal } from "../components/Modal";
import { btnCls, inputCls } from "../components/ui";
import { useFiltros } from "../hooks/useFiltros";
import { formatBRL, formatData } from "../lib/format";
import { hojeISO } from "../lib/lancamentos";
import { diasDeAtraso, ROTULO_STATUS, resumoTitulos, statusDoTitulo, validarTitulo } from "../lib/titulos";

const textoErro = (e: unknown) => mensagemErro(e, e instanceof Error ? e.message : undefined);
const paraEdicao = ({ id: _id, empresa_nome: _n, ...resto }: Titulo): TituloEdicao => resto;
const TIPOS: Record<string, string> = { "A pagar": "pagar", "A receber": "receber" };
const emBranco = (): TituloEdicao => ({
  tipo: "pagar", empresa_id: 0, forma: "NF", numero: "", descricao: "", valor: 0, vencimento: hojeISO(), pago_em: null,
});

function Selo({ titulo }: { titulo: Titulo }) {
  const s = statusDoTitulo(titulo);
  const cores = {
    pago: "bg-green-100 text-green-800",
    vencido: "bg-red-100 text-red-800",
    vence_hoje: "bg-amber-100 text-amber-800",
    a_vencer: "bg-slate-100 text-slate-700",
  }[s];
  const dias = diasDeAtraso(titulo);
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${cores}`}>
      {ROTULO_STATUS[s]}
      {s === "vencido" && ` há ${dias} dia${dias > 1 ? "s" : ""}`}
    </span>
  );
}

function FormPagamento({ titulo, enviando, erro, onConfirmar, onCancelar }: {
  titulo: Titulo; enviando: boolean; erro?: string; onConfirmar: (data: string) => void; onCancelar: () => void;
}) {
  const [data, setData] = useState(hojeISO());
  const problemas = validarTitulo({ ...paraEdicao(titulo), pago_em: data || null });
  return (
    <div className="space-y-3 text-sm">
      <p>
        {titulo.forma} {titulo.numero} · {titulo.empresa_nome} — <strong>{formatBRL(titulo.valor)}</strong>
      </p>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">Data do pagamento</span>
        <input className={inputCls} type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </label>
      {problemas.length > 0 && <p className="text-red-600">{problemas[0]}</p>}
      {erro && <p className="text-red-600">{erro}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button className="rounded-md border px-4 py-2 hover:bg-slate-50" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className={btnCls} onClick={() => onConfirmar(data)} disabled={enviando || problemas.length > 0}>
          {enviando ? "Salvando..." : "Marcar como pago"}
        </button>
      </div>
    </div>
  );
}

export default function Contas() {
  const f = useFiltros();
  const qc = useQueryClient();
  const { user } = useAuth();
  const ehAdmin = user?.role === "admin";
  const simular = f.get("simular");

  const consulta = useQuery({ queryKey: ["titulos", simular], queryFn: () => listarTitulos(simular), retry: false });
  const empresasQ = useQuery({ queryKey: ["empresas"], queryFn: listarEmpresas });
  const empresas = empresasQ.data ?? [];

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Titulo | null>(null);
  const [pagando, setPagando] = useState<Titulo | null>(null);
  const [excluindo, setExcluindo] = useState<Titulo | null>(null);
  const [novaEmpresa, setNovaEmpresa] = useState(false);

  const salvar = useMutation({
    mutationFn: ({ id, dados }: { id?: number; dados: TituloEdicao }) => (id ? atualizarTitulo(id, dados) : criarTitulo(dados)),
    onSuccess: () => {
      setCriando(false);
      setEditando(null);
      setPagando(null);
      qc.invalidateQueries({ queryKey: ["titulos"] });
    },
  });
  const excluir = useMutation({
    mutationFn: (id: number) => excluirTitulo(id),
    onSuccess: () => {
      setExcluindo(null);
      qc.invalidateQueries({ queryKey: ["titulos"] });
    },
  });
  const cadastrarEmpresa = useMutation({
    mutationFn: criarEmpresa,
    onSuccess: () => {
      setNovaEmpresa(false);
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });

  const tipo = f.get("tipo");
  const status = f.get("status");
  const empresa = f.get("empresa");
  const de = f.get("de");
  const ate = f.get("ate");
  const busca = f.get("busca").toLowerCase();

  const todos = consulta.data ?? [];
  const resumo = useMemo(() => resumoTitulos(todos), [todos]);
  const nomesEmpresas = useMemo(() => Array.from(new Set(todos.map((t) => t.empresa_nome))).sort(), [todos]);

  // Em aberto primeiro (vencimento mais próximo no topo); pagos depois.
  const filtrados = useMemo(
    () =>
      todos
        .filter(
          (t) =>
            (!tipo || t.tipo === TIPOS[tipo]) &&
            (!status || ROTULO_STATUS[statusDoTitulo(t)] === status) &&
            (!empresa || t.empresa_nome === empresa) &&
            (!de || t.vencimento >= de) &&
            (!ate || t.vencimento <= ate) &&
            (!busca || `${t.numero} ${t.descricao} ${t.empresa_nome}`.toLowerCase().includes(busca))
        )
        .sort((a, b) => Number(!!a.pago_em) - Number(!!b.pago_em) || (a.pago_em ? b.vencimento.localeCompare(a.vencimento) : a.vencimento.localeCompare(b.vencimento))),
    [todos, tipo, status, empresa, de, ate, busca]
  );

  const colunas = useMemo<ColumnDef<Titulo>[]>(
    () => [
      { accessorKey: "vencimento", header: "Vencimento", cell: (i) => formatData(i.getValue<string>()) },
      { accessorKey: "tipo", header: "Tipo", cell: (i) => (i.getValue<string>() === "pagar" ? "A pagar" : "A receber") },
      { accessorKey: "empresa_nome", header: "Empresa" },
      { id: "documento", header: "Documento", accessorFn: (t) => `${t.forma} ${t.numero}` },
      { accessorKey: "descricao", header: "Descrição" },
      {
        accessorKey: "valor",
        header: "Valor",
        meta: { align: "right" },
        cell: (i) => <span className={i.row.original.tipo === "pagar" ? "text-red-700" : "text-green-700"}>{formatBRL(i.getValue<number>())}</span>,
      },
      { id: "status", header: "Status", accessorFn: (t) => ROTULO_STATUS[statusDoTitulo(t)], cell: (i) => <Selo titulo={i.row.original} /> },
      { accessorKey: "pago_em", header: "Pago em", cell: (i) => formatData(i.getValue<string | null>()) },
      {
        id: "acoes",
        header: "",
        enableSorting: false,
        cell: (i) => {
          const t = i.row.original;
          return (
            <div className="flex justify-end gap-3 whitespace-nowrap text-sm">
              {t.pago_em ? (
                <button className="text-slate-600 hover:text-slate-900" onClick={() => salvar.mutate({ id: t.id, dados: { ...paraEdicao(t), pago_em: null } })}>
                  Desfazer pagamento
                </button>
              ) : (
                <button className="text-green-700 hover:text-green-900" onClick={() => { salvar.reset(); setPagando(t); }}>
                  Marcar como pago
                </button>
              )}
              <button className="text-slate-600 hover:text-slate-900" onClick={() => { salvar.reset(); setEditando(t); }}>
                Editar
              </button>
              <button className="text-red-600 hover:text-red-800" onClick={() => { excluir.reset(); setExcluindo(t); }}>
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

  const filtrosAtivos = [tipo, status, empresa, de, ate, busca].some(Boolean);
  const emAtraso = resumo.vencidosPagar.qtd + resumo.vencidosReceber.qtd;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contas a pagar e a receber</h1>
        <div className="flex gap-3">
          {ehAdmin && (
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" onClick={() => { cadastrarEmpresa.reset(); setNovaEmpresa(true); }}>
              + Nova empresa
            </button>
          )}
          <button className={btnCls} onClick={() => { salvar.reset(); setCriando(true); }}>
            + Novo título
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao titulo="A pagar em aberto" valor={formatBRL(resumo.aPagar)} />
        <Cartao titulo="A receber em aberto" valor={formatBRL(resumo.aReceber)} />
        <Cartao
          titulo={`Em atraso (${resumo.vencidosPagar.qtd} a pagar, ${resumo.vencidosReceber.qtd} a receber)`}
          valor={formatBRL(resumo.vencidosPagar.valor + resumo.vencidosReceber.valor)}
          destaque={emAtraso > 0 ? "erro" : undefined}
        />
        <Cartao titulo={`Vencem em 7 dias (${resumo.vencemEm7Dias.qtd})`} valor={formatBRL(resumo.vencemEm7Dias.valor)} />
      </div>

      <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
        <FiltroSelect label="Tipo" valor={tipo} onChange={(v) => f.set("tipo", v)} opcoes={Object.keys(TIPOS)} />
        <FiltroSelect label="Status" valor={status} onChange={(v) => f.set("status", v)} opcoes={Object.values(ROTULO_STATUS)} />
        <FiltroSelect label="Empresa" valor={empresa} onChange={(v) => f.set("empresa", v)} opcoes={nomesEmpresas} />
        <FiltroData label="Vence de" valor={de} onChange={(v) => f.set("de", v)} />
        <FiltroData label="Até" valor={ate} onChange={(v) => f.set("ate", v)} />
        <FiltroTexto label="Buscar" valor={f.get("busca")} onChange={(v) => f.set("busca", v)} placeholder="Número, descrição ou empresa" />
      </BarraFiltros>

      {salvar.isError && !criando && !editando && !pagando && <p className="text-sm text-red-600">{textoErro(salvar.error)}</p>}

      <DataTable
        columns={colunas}
        data={filtrados}
        isLoading={consulta.isLoading}
        error={consulta.error}
        onRetry={() => consulta.refetch()}
        vazio={filtrosAtivos ? "Nenhum título com esses filtros." : "Nenhuma NF ou boleto lançado ainda."}
      />

      {(criando || editando) && (
        <Modal titulo={editando ? "Editar título" : "Novo título"} onFechar={() => !salvar.isPending && (setCriando(false), setEditando(null))}>
          <FormTitulo
            inicial={editando ? paraEdicao(editando) : emBranco()}
            empresas={empresas}
            ehAdmin={ehAdmin}
            enviando={salvar.isPending}
            erroServidor={salvar.isError ? textoErro(salvar.error) : undefined}
            onSalvar={(dados) => salvar.mutate({ id: editando?.id, dados })}
            onCancelar={() => (setCriando(false), setEditando(null))}
          />
        </Modal>
      )}

      {pagando && (
        <Modal titulo="Marcar como pago" onFechar={() => !salvar.isPending && setPagando(null)}>
          <FormPagamento
            titulo={pagando}
            enviando={salvar.isPending}
            erro={salvar.isError ? textoErro(salvar.error) : undefined}
            onConfirmar={(data) => salvar.mutate({ id: pagando.id, dados: { ...paraEdicao(pagando), pago_em: data } })}
            onCancelar={() => setPagando(null)}
          />
        </Modal>
      )}

      {excluindo && (
        <Modal titulo="Excluir título?" onFechar={() => !excluir.isPending && setExcluindo(null)}>
          <div className="space-y-3 text-sm">
            <p>
              {excluindo.forma} {excluindo.numero} · {excluindo.empresa_nome} · vence em {formatData(excluindo.vencimento)} —{" "}
              <strong>{formatBRL(excluindo.valor)}</strong>
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

      {novaEmpresa && (
        <Modal titulo="Nova empresa" onFechar={() => !cadastrarEmpresa.isPending && setNovaEmpresa(false)}>
          <FormEmpresa
            enviando={cadastrarEmpresa.isPending}
            erroServidor={cadastrarEmpresa.isError ? textoErro(cadastrarEmpresa.error) : undefined}
            onSalvar={(dados) => cadastrarEmpresa.mutate(dados)}
            onCancelar={() => setNovaEmpresa(false)}
          />
        </Modal>
      )}
    </div>
  );
}
