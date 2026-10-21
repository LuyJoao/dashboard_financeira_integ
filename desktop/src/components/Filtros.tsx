import { ReactNode } from "react";
import { inputCls } from "./ui";

export function BarraFiltros({
  children,
  mostrarLimpar,
  onLimpar,
}: {
  children: ReactNode;
  mostrarLimpar?: boolean;
  onLimpar?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
      {children}
      {mostrarLimpar && (
        <button onClick={onLimpar} className="pb-2 text-sm text-slate-500 hover:text-slate-900">
          Limpar filtros
        </button>
      )}
    </div>
  );
}

const rotulo = "mb-1 block text-xs text-slate-500";

export function FiltroSelect({
  label,
  valor,
  onChange,
  opcoes,
  todas = "Todas",
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: string[];
  todas?: string;
}) {
  return (
    <label>
      <span className={rotulo}>{label}</span>
      <select className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{todas}</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FiltroTexto({
  label,
  valor,
  onChange,
  placeholder,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className={rotulo}>{label}</span>
      <input className={inputCls} value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function FiltroData({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span className={rotulo}>{label}</span>
      <input className={inputCls} type="date" value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
