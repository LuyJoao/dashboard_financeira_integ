import type { DadosDashboard } from "../api/dashboard";

// Converte os dados da API nos números que as telas exibem.
// incluirAplicacoes = false -> aplicações e resgates ficam FORA de receitas/despesas (sugerido).
// incluirAplicacoes = true  -> como na planilha original: aplicação conta como despesa e resgate como receita.
// Na saída, "despesas" é sempre positivo e resultado = receitas - despesas.
export function calcular(d: DadosDashboard, incluirAplicacoes: boolean) {
  const meses = d.meses.map((m) => {
    const receitas = m.receitas + (incluirAplicacoes ? m.resgates : 0);
    const despesas = Math.abs(m.despesas + (incluirAplicacoes ? m.aplicacoes : 0));
    return { mes: m.mes, receitas, despesas, resultado: receitas - despesas };
  });

  const soma = (f: (m: (typeof meses)[number]) => number) => meses.reduce((t, m) => t + f(m), 0);
  const receitas = soma((m) => m.receitas);
  const despesas = soma((m) => m.despesas);

  const aplicacoes = d.meses.reduce((t, m) => t + m.aplicacoes, 0);
  const resgates = d.meses.reduce((t, m) => t + m.resgates, 0);

  const categorias = d.categorias.map((c) => ({ categoria: c.categoria, receitas: c.receitas, despesas: Math.abs(c.despesas) }));
  if (incluirAplicacoes) {
    categorias.push({ categoria: "Aplicação Financeira (principal)", receitas: resgates, despesas: Math.abs(aplicacoes) });
  }
  categorias.sort((a, b) => b.receitas + b.despesas - (a.receitas + a.despesas));

  const saldoPorMes = d.meses.map((m) => ({
    mes: m.mes,
    saldo: d.saldos.filter((s) => s.mes === m.mes).reduce((t, s) => t + s.saldo_informado, 0),
  }));

  const divergencias = d.saldos.filter((s) => s.status !== "OK").length;
  const ultimoMes = d.meses[d.meses.length - 1]?.mes ?? "";

  return {
    meses,
    receitas,
    despesas,
    resultado: receitas - despesas,
    totalMovimentado: receitas + despesas, // Total Movimentado (ABS) = receitas + despesas em valor absoluto
    aplicadoLiquido: -(aplicacoes + resgates), // positivo = dinheiro que saiu das contas e está investido
    saldoAtual: saldoPorMes[saldoPorMes.length - 1]?.saldo ?? 0,
    saldoPorMes,
    categorias,
    divergencias,
    combinacoes: d.saldos.length,
    ultimoMes,
    contasUltimoMes: d.saldos.filter((s) => s.mes === ultimoMes),
  };
}
