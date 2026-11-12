import { DADOS_DASHBOARD } from "../mock/dashboardDados";
import { listarManuaisMock } from "../mock/lancamentos";
import type { DadosDashboard, SaldoAplicadoMes, SaldoContaMes } from "./dashboard";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotulo = (dataISO: string) => {
  const [ano, mes] = dataISO.split("-");
  return `${MESES[Number(mes) - 1]}/${ano.slice(-2)}`;
};
const ordemDoMes = (mes: string) => {
  const [nome, ano] = mes.split("/");
  return Number(`20${ano}`) * 12 + MESES.indexOf(nome);
};

// Simula o que a API fará: junta os lançamentos manuais ao que veio da importação.
// Regras dos saldos (veja docs/regra-saldos.md):
// - Mês com saldo do extrato: o lançamento manual muda o saldo CALCULADO; o do extrato continua o mesmo,
//   então aparece DIVERGÊNCIA até alguém ajustar.
// - Mês só com lançamentos manuais: saldo calculado a partir do mês anterior, status "NÃO CONFERIDO".
export async function buscarDashboardMock(): Promise<DadosDashboard> {
  await new Promise((r) => setTimeout(r, 700));
  const resumo = DADOS_DASHBOARD.resumo.map((l) => ({ ...l }));
  const saldos: SaldoContaMes[] = DADOS_DASHBOARD.saldos.map((s) => ({ ...s }));
  const aplicado: SaldoAplicadoMes[] = DADOS_DASHBOARD.aplicado.map((a) => ({ ...a }));
  const mesesBase = new Set(DADOS_DASHBOARD.meses);
  const meses = new Set(DADOS_DASHBOARD.meses);
  const contas = new Set(DADOS_DASHBOARD.contas);
  const categorias = new Set(DADOS_DASHBOARD.categorias);
  const manuais = listarManuaisMock();

  for (const lancamento of manuais) {
    const mesLabel = rotulo(lancamento.data);
    meses.add(mesLabel);
    contas.add(lancamento.banco);
    categorias.add(lancamento.categoria);

    const movimento =
      lancamento.categoria !== "Aplicação Financeira"
        ? null
        : lancamento.observacao === "Investimento"
          ? "aplicacao"
          : lancamento.observacao === "Resgate"
            ? "resgate"
            : "rendimento";
    const linha = resumo.find(
      (l) => l.mes === mesLabel && l.conta === lancamento.banco && l.categoria === lancamento.categoria && l.movimento === movimento
    );
    if (linha) {
      linha.receitas += lancamento.valor > 0 ? lancamento.valor : 0;
      linha.despesas += lancamento.valor < 0 ? lancamento.valor : 0;
    } else {
      resumo.push({
        mes: mesLabel,
        conta: lancamento.banco,
        categoria: lancamento.categoria,
        movimento,
        receitas: lancamento.valor > 0 ? lancamento.valor : 0,
        despesas: lancamento.valor < 0 ? lancamento.valor : 0,
      });
    }
  }

  const ordenados = Array.from(meses).sort((a, b) => ordemDoMes(a) - ordemDoMes(b));
  const listaContas = Array.from(contas);
  const movDoMes = (mes: string, conta: string) => {
    const ls = manuais.filter((l) => rotulo(l.data) === mes && l.banco === conta);
    return {
      entradas: ls.filter((l) => l.valor > 0).reduce((t, l) => t + l.valor, 0),
      saidas: ls.filter((l) => l.valor < 0).reduce((t, l) => t + l.valor, 0),
    };
  };

  const ultimoSaldo: Record<string, number> = {}; // saldo final do mês anterior, por conta
  let ultimoAplicado = 0;
  for (const mes of ordenados) {
    if (mesesBase.has(mes)) {
      for (const conta of listaContas) {
        const s = saldos.find((x) => x.mes === mes && x.conta === conta);
        if (!s) continue;
        const mov = movDoMes(mes, conta);
        s.entradas += mov.entradas;
        s.saidas += mov.saidas;
        s.saldo_final = s.saldo_inicial + s.entradas + s.saidas;
        s.diferenca = s.saldo_final - s.saldo_informado;
        s.status = s.diferenca === 0 ? "OK" : "DIVERGÊNCIA";
        ultimoSaldo[conta] = s.saldo_informado;
      }
      ultimoAplicado = aplicado.find((a) => a.mes === mes)?.saldo_final ?? ultimoAplicado;
    } else {
      // mês criado só por lançamentos manuais: calcula a partir do mês anterior, para todas as contas
      for (const conta of listaContas) {
        const mov = movDoMes(mes, conta);
        const inicial = ultimoSaldo[conta] ?? 0;
        const final = inicial + mov.entradas + mov.saidas;
        saldos.push({
          mes, conta, saldo_inicial: inicial, entradas: mov.entradas, saidas: mov.saidas,
          saldo_final: final, saldo_informado: final, diferenca: 0, status: "NÃO CONFERIDO",
        });
        ultimoSaldo[conta] = final;
      }
      const fluxo = manuais
        .filter((l) => rotulo(l.data) === mes && l.categoria === "Aplicação Financeira" && l.observacao !== "Rendimento")
        .reduce((t, l) => t + l.valor, 0);
      const final = ultimoAplicado - fluxo; // aplicado menos resgatado
      aplicado.push({ mes, saldo_inicial: ultimoAplicado, saldo_final: final });
      ultimoAplicado = final;
    }
  }

  return {
    ...DADOS_DASHBOARD,
    resumo,
    saldos,
    aplicado,
    meses: ordenados,
    contas: listaContas,
    categorias: Array.from(categorias).sort(),
  };
}
