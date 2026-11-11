import { DADOS_DASHBOARD } from "../mock/dashboardDados";
import { listarManuaisMock } from "../mock/lancamentos";
import type { DadosDashboard } from "./dashboard";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function buscarDashboardMock(): Promise<DadosDashboard> {
  await new Promise((r) => setTimeout(r, 700));
  const resumo = DADOS_DASHBOARD.resumo.map((l) => ({ ...l }));
  const meses = new Set(DADOS_DASHBOARD.meses);
  const contas = new Set(DADOS_DASHBOARD.contas);
  const categorias = new Set(DADOS_DASHBOARD.categorias);

  for (const lancamento of listarManuaisMock()) {
    const [ano, mes] = lancamento.data.split("-");
    const mesLabel = `${MESES[Number(mes) - 1]}/${ano.slice(-2)}`;
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
      (l) =>
        l.mes === mesLabel &&
        l.conta === lancamento.banco &&
        l.categoria === lancamento.categoria &&
        l.movimento === movimento
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

  const mesEmOrdem = (mes: string) => {
    const [nome, ano] = mes.split("/");
    return Number(`20${ano}`) * 12 + MESES.indexOf(nome);
  };
  return {
    ...DADOS_DASHBOARD,
    resumo,
    meses: Array.from(meses).sort((a, b) => mesEmOrdem(a) - mesEmOrdem(b)),
    contas: Array.from(contas),
    categorias: Array.from(categorias),
  };
}
