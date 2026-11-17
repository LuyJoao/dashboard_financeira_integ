import { FormEvent, useState } from "react";
import type { LancamentoEdicao, Tipo } from "../api/lancamentos";
import { OBS_APLICACAO, parseValorBRL, validar, valorParaCampo } from "../lib/lancamentos";
import { btnCls, inputCls } from "./ui";

type Props = {
  inicial: LancamentoEdicao;
  contas: string[];
  categorias: string[];
  enviando: boolean;
  erroServidor?: string;
  nota?: string;
  onSalvar: (dados: LancamentoEdicao) => void;
  onCancelar: () => void;
};

const rotulo = "mb-1 block text-xs text-slate-500";

export function FormLancamento({ inicial, contas, categorias, enviando, erroServidor, nota, onSalvar, onCancelar }: Props) {
  const [data, setData] = useState(inicial.data);
  const [banco, setBanco] = useState(inicial.banco);
  const [categoria, setCategoria] = useState(inicial.categoria);
  const [tipo, setTipo] = useState<Tipo>(inicial.tipo);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [observacao, setObservacao] = useState(inicial.observacao);
  const [valorTxt, setValorTxt] = useState(inicial.valor === 0 ? "" : valorParaCampo(inicial.valor));
  const [erros, setErros] = useState<string[]>([]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const centavos = parseValorBRL(valorTxt);
    if (centavos === null) {
      setErros(["Valor inválido. Digite só números e vírgula, por exemplo 1234,56 (o sinal vem do tipo)."]);
      return;
    }
    // Receita entra com sinal positivo; Despesa e Investimento, negativo.
    const dados: LancamentoEdicao = {
      data,
      banco,
      categoria,
      tipo,
      descricao: descricao.trim(),
      observacao: observacao.trim(),
      valor: (tipo === "Receita" ? 1 : -1) * centavos,
    };
    const problemas = validar(dados);
    setErros(problemas);
    if (problemas.length === 0) onSalvar(dados);
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={rotulo}>Data</span>
          <input className={inputCls} type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        <label>
          <span className={rotulo}>Conta</span>
          <select className={inputCls} value={banco} onChange={(e) => setBanco(e.target.value)}>
            {contas.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={rotulo}>Categoria</span>
          <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={rotulo}>Tipo</span>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            <option>Receita</option>
            <option>Despesa</option>
            <option>Investimento</option>
          </select>
        </label>
        <label>
          <span className={rotulo}>Valor (R$)</span>
          <input className={inputCls} inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} />
        </label>
        <label>
          <span className={rotulo}>Observação</span>
          {categoria === "Aplicação Financeira" ? (
            <select className={inputCls} value={observacao} onChange={(e) => setObservacao(e.target.value)}>
              <option value="">Escolha...</option>
              {OBS_APLICACAO.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input className={inputCls} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          )}
        </label>
      </div>
      <label className="block">
        <span className={rotulo}>Descrição</span>
        <input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>

      <p className="text-xs text-slate-500">
        {nota ?? "O sinal do valor vem do tipo. Reimportar a mesma planilha sobrescreve esta edição."}
      </p>

      {erros.length > 0 && (
        <ul className="list-disc space-y-1 rounded-md bg-red-50 p-3 pl-6 text-sm text-red-700">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {erroServidor && <p className="text-sm text-red-600">{erroServidor}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className={btnCls} disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
