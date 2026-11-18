import type { DadosSaldos } from "../api/saldos";

export type VisaoMes = {
  mes: string;
  contas: number; // soma do saldo do fim do mês nas contas
  aplicado: number | null;
  total: number | null; // contas + aplicado
  variacao: number | null; // total do fim menos total do início do mês (o "resultado do mês")
  divergencias: number;
  naoConferidos: number;
};

// Uma linha por mês, para analisar a evolução e achar rápido os meses com divergência.
export function visaoPorMes(d: DadosSaldos): VisaoMes[] {
  const soma = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
  return d.meses.map((mes) => {
    const linhas = d.saldos.filter((s) => s.mes === mes);
    const ap = d.aplicado.find((a) => a.mes === mes);
    const contas = soma(linhas.map((s) => s.saldo_informado));
    const contasIni = soma(linhas.map((s) => s.saldo_inicial));
    return {
      mes,
      contas,
      aplicado: ap ? ap.saldo_final : null,
      total: ap ? contas + ap.saldo_final : null,
      variacao: ap ? contas + ap.saldo_final - (contasIni + ap.saldo_inicial) : null,
      divergencias: linhas.filter((s) => s.status === "DIVERGÊNCIA").length,
      naoConferidos: linhas.filter((s) => s.status === "NÃO CONFERIDO").length,
    };
  });
}
