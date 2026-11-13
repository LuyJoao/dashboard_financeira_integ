import { FormEvent, useState } from "react";
import type { EmpresaNova, TipoEmpresa } from "../api/empresas";
import { btnCls, inputCls } from "./ui";

type Props = {
  enviando: boolean;
  erroServidor?: string;
  onSalvar: (dados: EmpresaNova) => void;
  onCancelar: () => void;
};

const rotulo = "mb-1 block text-xs text-slate-500";

function formatarCnpj(d: string) {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function FormEmpresa({ enviando, erroServidor, onSalvar, onCancelar }: Props) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoEmpresa>("fornecedor");
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState("");

  function enviar(e: FormEvent) {
    e.preventDefault();
    const digitos = cnpj.replace(/\D/g, "");
    if (!nome.trim()) return setErro("Informe o nome da empresa.");
    if (digitos && digitos.length !== 14) return setErro("O CNPJ deve ter 14 números (ou deixe em branco).");
    setErro("");
    onSalvar({ nome: nome.trim(), tipo, cnpj: digitos ? formatarCnpj(digitos) : null });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <label className="block">
        <span className={rotulo}>Nome</span>
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={rotulo}>Tipo</span>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoEmpresa)}>
            <option value="fornecedor">Fornecedor</option>
            <option value="incubada">Incubada</option>
          </select>
        </label>
        <label>
          <span className={rotulo}>CNPJ (opcional)</span>
          <input className={inputCls} value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        </label>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {erroServidor && <p className="text-sm text-red-600">{erroServidor}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button className={btnCls} disabled={enviando}>
          {enviando ? "Salvando..." : "Cadastrar empresa"}
        </button>
      </div>
    </form>
  );
}
