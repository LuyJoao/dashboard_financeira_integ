import type { Empresa } from "../api/empresas";
import type { Titulo } from "../api/titulos";
import { statusDoTitulo } from "./titulos";

export const ROTULO_TIPO_EMPRESA = { incubada: "Incubada", fornecedor: "Fornecedor" } as const;

export type ResumoEmpresa = {
  aPagar: number; // em aberto
  aReceber: number; // em aberto
  vencidosQtd: number;
  vencidosValor: number;
  totalTitulos: number;
};

const vazio = (): ResumoEmpresa => ({ aPagar: 0, aReceber: 0, vencidosQtd: 0, vencidosValor: 0, totalTitulos: 0 });

// Soma os títulos de cada empresa. Atraso = não pago e vencimento antes de hoje (calculado, não guardado).
export function resumoPorEmpresa(titulos: Titulo[], hoje?: string): Map<number, ResumoEmpresa> {
  const mapa = new Map<number, ResumoEmpresa>();
  for (const t of titulos) {
    const r = mapa.get(t.empresa_id) ?? vazio();
    r.totalTitulos += 1;
    if (!t.pago_em) {
      if (t.tipo === "pagar") r.aPagar += t.valor;
      else r.aReceber += t.valor;
      if (statusDoTitulo(t, hoje) === "vencido") {
        r.vencidosQtd += 1;
        r.vencidosValor += t.valor;
      }
    }
    mapa.set(t.empresa_id, r);
  }
  return mapa;
}

export type LinhaEmpresa = Empresa & ResumoEmpresa;

export function linhasDeEmpresas(empresas: Empresa[], titulos: Titulo[], hoje?: string): LinhaEmpresa[] {
  const mapa = resumoPorEmpresa(titulos, hoje);
  return empresas.map((e) => ({ ...e, ...(mapa.get(e.id) ?? vazio()) }));
}
