import { FormEvent, useState } from "react";
import type { Empresa } from "../api/empresas";
import type { FormaTitulo, TipoTitulo, TituloEdicao } from "../api/titulos";
import { parseValorBRL, valorParaCampo } from "../lib/lancamentos";
import { validarTitulo } from "../lib/titulos";
import { btnCls, inputCls } from "./ui";

type Props = {
  inicial: TituloEdicao;
  empresas: Empresa[];
  ehAdmin: boolean;
  enviando: boolean;
  erroServidor?: string;
  onSalvar: (dados: TituloEdicao) => void;
  onCancelar: () => void;
};

const rotulo = "mb-1 block text-xs text-slate-500";

export function FormTitulo({ inicial, empresas, ehAdmin, enviando, erroServidor, onSalvar, onCancelar }: Props) {
  const [tipo, setTipo] = useState<TipoTitulo>(inicial.tipo);
  const [forma, setForma] = useState<FormaTitulo>(inicial.forma);
  const [empresaId, setEmpresaId] = useState(inicial.empresa_id);
  const [numero, setNumero] = useState(inicial.numero);
  const [valorTxt, setValorTxt] = useState(inicial.valor === 0 ? "" : valorParaCampo(inicial.valor));
  const [vencimento, setVencimento] = useState(inicial.vencimento);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [pagoEm, setPagoEm] = useState(inicial.pago_em ?? "");
  const [erros, setErros] = useState<string[]>([]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const centavos = parseValorBRL(valorTxt);
    if (centavos === null) {
      setErros(["Valor inválido. Digite só números e vírgula, por exemplo 1234,56."]);
      return;
    }
    const dados: TituloEdicao = {
      tipo,
      forma,
      empresa_id: empresaId,
      numero: numero.trim(),
      descricao: descricao.trim(),
      valor: centavos,
      vencimento,
      pago_em: pagoEm || null,
    };
    const problemas = validarTitulo(dados);
    setErros(problemas);
    if (problemas.length === 0) onSalvar(dados);
  }

  const ordenadas = [...empresas].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={rotulo}>Tipo</span>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoTitulo)}>
            <option value="pagar">A pagar</option>
            <option value="receber">A receber</option>
          </select>
        </label>
        <label>
          <span className={rotulo}>Documento</span>
          <select className={inputCls} value={forma} onChange={(e) => setForma(e.target.value as FormaTitulo)}>
            <option>NF</option>
            <option>Boleto</option>
          </select>
        </label>
        <label className="col-span-2">
          <span className={rotulo}>Empresa</span>
          <select className={inputCls} value={empresaId} onChange={(e) => setEmpresaId(Number(e.target.value))}>
            <option value={0}>Escolha...</option>
            {ordenadas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome} ({e.tipo === "incubada" ? "incubada" : "fornecedor"})
              </option>
            ))}
          </select>
          {empresas.length === 0 && (
            <span className="mt-1 block text-xs text-amber-700">
              {ehAdmin ? "Cadastre a empresa primeiro (botão Nova empresa)." : "Peça ao administrador para cadastrar a empresa."}
            </span>
          )}
        </label>
        <label>
          <span className={rotulo}>Número do documento</span>
          <input className={inputCls} value={numero} onChange={(e) => setNumero(e.target.value)} />
        </label>
        <label>
          <span className={rotulo}>Valor (R$)</span>
          <input className={inputCls} inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} />
        </label>
        <label>
          <span className={rotulo}>Vencimento</span>
          <input className={inputCls} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
        </label>
        <label>
          <span className={rotulo}>Pago em (vazio = ainda não pago)</span>
          <input className={inputCls} type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className={rotulo}>Descrição</span>
        <input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>

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
