import type { Lancamento, LancamentoEdicao } from "../api/lancamentos";

// Dados falsos no formato da aba "Base". As linhas 12, 14 e 16 são INCONSISTENTES de propósito
// (copiadas dos erros reais da planilha) para testar o aviso e a correção na tela.
let DADOS: Lancamento[] = [
  { id: 1, data: "2026-01-05", banco: "136 - Unicred", categoria: "Vendas Bazar", tipo: "Receita", descricao: "Depósito vendas do bazar", observacao: "", valor: 125000 },
  { id: 2, data: "2026-01-08", banco: "104 - Caixa", categoria: "Insumos Laboratório", tipo: "Despesa", descricao: "Compra de reagentes", observacao: "", valor: -48790 },
  { id: 3, data: "2026-01-12", banco: "341 - Itaú", categoria: "Tarifas Bancárias", tipo: "Despesa", descricao: "Tarifa mensal", observacao: "", valor: -8000 },
  { id: 4, data: "2026-01-15", banco: "136 - Unicred", categoria: "Aplicação Financeira", tipo: "Investimento", descricao: "Aplicação Financeira", observacao: "Investimento", valor: -21500000 },
  { id: 5, data: "2026-01-20", banco: "341 - Itaú", categoria: "Aplicação Financeira", tipo: "Receita", descricao: "Aplicação Financeira", observacao: "Rendimento", valor: 5714 },
  { id: 6, data: "2026-02-03", banco: "104 - Caixa", categoria: "Taxa de Incubação", tipo: "Receita", descricao: "Taxa de incubação", observacao: "Empresa NanoSphera", valor: 5000 },
  { id: 7, data: "2026-02-10", banco: "136 - Unicred", categoria: "Internet/Telecom", tipo: "Despesa", descricao: "Internet do mês", observacao: "", valor: -19990 },
  { id: 8, data: "2026-02-18", banco: "104 - Caixa", categoria: "Análises de Águas", tipo: "Receita", descricao: "Análise de água", observacao: "", valor: 65000 },
  { id: 9, data: "2026-03-02", banco: "136 - Unicred", categoria: "Vendas Bazar", tipo: "Receita", descricao: "Depósito vendas do bazar", observacao: "", valor: 13554200 },
  { id: 10, data: "2026-03-09", banco: "104 - Caixa", categoria: "Serviços Contábeis", tipo: "Despesa", descricao: "Honorários contábeis", observacao: "", valor: -120000 },
  { id: 11, data: "2026-04-07", banco: "136 - Unicred", categoria: "Aplicação Financeira", tipo: "Investimento", descricao: "Aplicação Financeira", observacao: "Investimento", valor: -30000000 },
  { id: 12, data: "2026-04-14", banco: "341 - Itaú", categoria: "Tarifas Bancárias", tipo: "Receita", descricao: "Tarifa PIX", observacao: "", valor: -2002 },
  { id: 13, data: "2026-05-14", banco: "104 - Caixa", categoria: "Convênio/Bolsas", tipo: "Despesa", descricao: "Bolsa de pesquisa", observacao: "", valor: -400000 },
  { id: 14, data: "2026-06-11", banco: "136 - Unicred", categoria: "Aplicação Financeira", tipo: "Receita", descricao: "Resgate Aplicação", observacao: "", valor: 2000001 },
  { id: 15, data: "2026-06-25", banco: "104 - Caixa", categoria: "Vendas Bazar", tipo: "Receita", descricao: "Venda de itens do bazar", observacao: "", valor: 87450 },
  { id: 16, data: "2026-05-20", banco: "104 - Caixa", categoria: "Análises de Águas", tipo: "Despesa", descricao: "Análise de água (cliente)", observacao: "", valor: 65000 },
];
let DADOS_MANUAIS: Lancamento[] = [];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ?simular=erro | vazio | lento testa os estados da lista. Descrição com "falha" testa erro ao salvar.
export async function listarMock(simular = ""): Promise<Lancamento[]> {
  await esperar(simular === "lento" ? 3000 : 600);
  if (simular === "erro") throw new Error("falha simulada");
  return simular === "vazio" ? [] : [...DADOS];
}

export async function atualizarMock(id: number, dados: LancamentoEdicao): Promise<Lancamento> {
  await esperar(500);
  if (dados.descricao.toLowerCase().includes("falha")) throw new Error("falha simulada");
  const i = DADOS.findIndex((l) => l.id === id);
  if (i < 0) throw new Error("lançamento não encontrado");
  DADOS[i] = { id, ...dados };
  const manual = DADOS_MANUAIS.findIndex((l) => l.id === id);
  if (manual >= 0) DADOS_MANUAIS[manual] = DADOS[i];
  return DADOS[i];
}

export async function excluirMock(id: number): Promise<void> {
  await esperar(500);
  DADOS = DADOS.filter((l) => l.id !== id);
  DADOS_MANUAIS = DADOS_MANUAIS.filter((l) => l.id !== id);
}

let proximoId = 17;

export async function criarMock(dados: LancamentoEdicao): Promise<Lancamento> {
  await esperar(500);
  if (dados.descricao.toLowerCase().includes("falha")) throw new Error("falha simulada");
  const novo: Lancamento = { id: proximoId++, ...dados };
  DADOS = [...DADOS, novo];
  DADOS_MANUAIS = [...DADOS_MANUAIS, novo];
  return novo;
}

export function listarManuaisMock(): Lancamento[] {
  return DADOS_MANUAIS.map((l) => ({ ...l }));
}
