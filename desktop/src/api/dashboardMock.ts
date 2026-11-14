import { DADOS_DASHBOARD } from "../mock/dashboardDados";
import { listarManuaisMock } from "../mock/lancamentos";
import { obterOverrideAplicado, obterOverrideSaldo } from "../mock/saldosOverrides";
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

export type ExtraAplicado = Record<string, { calculado: number; sobrescrito: boolean }>;

// saldo_final = calculado (inicial + entradas + saídas). Com saldo do extrato: OK ou DIVERGÊNCIA. Sem ele: NÃO CONFERIDO.
function recalcular(s: SaldoContaMes, extrato: number | null) {
  s.saldo_final = s.saldo_inicial + s.entradas + s.saidas;
  if (extrato === null) {
    s.saldo_informado = s.saldo_final;
    s.diferenca = 0;
    s.status = "NÃO CONFERIDO";
  } else {
    s.saldo_informado = extrato;
    s.diferenca = s.saldo_final - extrato;
    s.status = s.diferenca === 0 ? "OK" : "DIVERGÊNCIA";
  }
}

// Simula o que a API fará: junta ao que veio da importação os lançamentos manuais e o que o usuário informou na tela de Saldos.
// Regras dos saldos: veja docs/regra-saldos.md.
export function montarDadosDashboardMock(): { dados: DadosDashboard; aplicadoExtra: ExtraAplicado } {
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
  // aplicações (negativas) e resgates (positivos) lançados à mão; rendimento não conta
  const fluxoAplicacaoManual = (mes: string) =>
    manuais.filter((l) => rotulo(l.data) === mes && l.categoria === "Aplicação Financeira" && l.observacao !== "Rendimento").reduce((t, l) => t + l.valor, 0);

  const ultimoSaldo: Record<string, number> = {}; // saldo final do mês anterior, por conta
  const aplicadoExtra: ExtraAplicado = {};
  let ultimoAplicado = 0;
  let primeiroAplicado = true;

  for (const mes of ordenados) {
    for (const conta of listaContas) {
      const ov = obterOverrideSaldo(mes, conta);
      let s = saldos.find((x) => x.mes === mes && x.conta === conta);
      const mov = movDoMes(mes, conta);
      if (s) {
        // mês com saldo do extrato (importado): o lançamento manual muda o calculado, o do extrato continua
        s.entradas += mov.entradas;
        s.saidas += mov.saidas;
        if (ov) s.saldo_inicial = ov.saldo_inicial;
        recalcular(s, ov ? ov.saldo_extrato : s.saldo_informado);
      } else if (!mesesBase.has(mes)) {
        // mês criado só por lançamentos manuais: calcula a partir do mês anterior, para todas as contas
        s = {
          mes, conta, saldo_inicial: ov?.saldo_inicial ?? ultimoSaldo[conta] ?? 0, entradas: mov.entradas, saidas: mov.saidas,
          saldo_final: 0, saldo_informado: 0, diferenca: 0, status: "NÃO CONFERIDO",
        };
        recalcular(s, ov ? ov.saldo_extrato : null);
        saldos.push(s);
      }
      if (s) ultimoSaldo[conta] = s.saldo_informado;
    }

    let a = aplicado.find((x) => x.mes === mes);
    const ovA = obterOverrideAplicado(mes);
    if (a) {
      const fluxo = a.saldo_final - a.saldo_inicial; // aplicações menos resgates do mês, dos dados de exemplo
      if (!primeiroAplicado) a.saldo_inicial = ultimoAplicado; // encadeia com o mês anterior
      const calculado = a.saldo_inicial + fluxo - fluxoAplicacaoManual(mes);
      a.saldo_final = ovA ?? calculado;
      aplicadoExtra[mes] = { calculado, sobrescrito: ovA !== undefined };
    } else {
      const calculado = ultimoAplicado - fluxoAplicacaoManual(mes);
      a = { mes, saldo_inicial: ultimoAplicado, saldo_final: ovA ?? calculado };
      aplicado.push(a);
      aplicadoExtra[mes] = { calculado, sobrescrito: ovA !== undefined };
    }
    ultimoAplicado = a.saldo_final;
    primeiroAplicado = false;
  }

  return {
    dados: {
      ...DADOS_DASHBOARD,
      resumo,
      saldos,
      aplicado,
      meses: ordenados,
      contas: listaContas,
      categorias: Array.from(categorias).sort(),
    },
    aplicadoExtra,
  };
}

export async function buscarDashboardMock(): Promise<DadosDashboard> {
  await new Promise((r) => setTimeout(r, 700));
  return montarDadosDashboardMock().dados;
}
