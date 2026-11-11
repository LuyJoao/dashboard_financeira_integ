import type { DadosDashboard, LinhaResumo } from "../api/dashboard";

export type Filtros = { mes: string; conta: string; categoria: string };

const soma = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

// Regras decididas com a supervisora:
// - Aplicações, resgates e rendimentos ficam FORA de receitas e despesas, cada um em sua linha.
// - Saldo nas contas = soma do saldo final INFORMADO das contas (como o SOMASES da planilha).
// - Saldo aplicado é informado; Total = contas + aplicado.
// - Resultado do mês = variação do Total (final menos inicial).
// - Total movimentado (ABS) inclui aplicações, resgates e rendimentos.
// Saldo aplicado e Total não existem por conta; com filtro de conta eles não são mostrados.
export function calcular(d: DadosDashboard, f: Filtros) {
  const mes = f.mes || d.meses[d.meses.length - 1];
  const passa = (l: LinhaResumo) => (!f.conta || l.conta === f.conta) && (!f.categoria || l.categoria === f.categoria);

  const linhasMes = d.resumo.filter((l) => l.mes === mes && passa(l));
  const comum = linhasMes.filter((l) => l.movimento === null);
  const receitas = soma(comum.map((l) => l.receitas));
  const despesas = Math.abs(soma(comum.map((l) => l.despesas)));
  const rendimentos = soma(linhasMes.filter((l) => l.movimento === "rendimento").map((l) => l.receitas));
  const aplicacoes = Math.abs(soma(linhasMes.filter((l) => l.movimento === "aplicacao").map((l) => l.despesas)));
  const resgates = soma(linhasMes.filter((l) => l.movimento === "resgate").map((l) => l.receitas));
  const totalMovimentado = receitas + despesas + rendimentos + aplicacoes + resgates;

  const mostrarAplicado = !f.conta;
  const doMes = d.saldos.filter((s) => s.mes === mes && (!f.conta || s.conta === f.conta));
  const saldoContas = soma(doMes.map((s) => s.saldo_informado));
  const saldoContasInicial = soma(doMes.map((s) => s.saldo_inicial));
  const aplicadoMes = d.aplicado.find((a) => a.mes === mes);
  const saldoAplicado = mostrarAplicado && aplicadoMes ? aplicadoMes.saldo_final : null;
  const total = saldoAplicado === null ? null : saldoContas + saldoAplicado;

  // Com filtro de categoria o saldo não se aplica: mostra o resultado só daquela categoria.
  const resultadoDeCategoria = !!f.categoria;
  const resultado = resultadoDeCategoria
    ? receitas + rendimentos - despesas
    : saldoContas + (saldoAplicado ?? 0) - (saldoContasInicial + (mostrarAplicado && aplicadoMes ? aplicadoMes.saldo_inicial : 0));

  const serieSaldo = d.meses.map((m) => {
    const contas = soma(d.saldos.filter((s) => s.mes === m && (!f.conta || s.conta === f.conta)).map((s) => s.saldo_informado));
    const ap = mostrarAplicado ? (d.aplicado.find((a) => a.mes === m)?.saldo_final ?? null) : null;
    return { mes: m, contas, aplicado: ap, total: ap === null ? null : contas + ap };
  });

  const serieMeses = d.meses.map((m) => {
    const ls = d.resumo.filter((l) => l.mes === m && passa(l) && l.movimento === null);
    return { mes: m, receitas: soma(ls.map((l) => l.receitas)), despesas: Math.abs(soma(ls.map((l) => l.despesas))) };
  });

  // Gráfico por categoria (mês escolhido): rendimentos aparecem como uma categoria própria; aplicações e resgates ficam de fora.
  const porCategoria = new Map<string, { categoria: string; receitas: number; despesas: number }>();
  for (const l of linhasMes) {
    if (l.movimento === "aplicacao" || l.movimento === "resgate") continue;
    const nome = l.movimento === "rendimento" ? "Rendimentos de Aplicações" : l.categoria;
    const item = porCategoria.get(nome) ?? { categoria: nome, receitas: 0, despesas: 0 };
    item.receitas += l.receitas;
    item.despesas += Math.abs(l.despesas);
    porCategoria.set(nome, item);
  }
  const categorias = Array.from(porCategoria.values()).sort((a, b) => b.receitas + b.despesas - (a.receitas + a.despesas));

  return {
    mes,
    receitas,
    despesas,
    rendimentos,
    aplicacoes,
    resgates,
    totalMovimentado,
    saldoContas,
    saldoAplicado,
    total,
    resultado,
    resultadoDeCategoria,
    serieSaldo,
    serieMeses,
    categorias,
    saldosDoMes: doMes,
    divergencias: doMes.filter((s) => s.status !== "OK").length,
    mostrarAplicado,
  };
}
