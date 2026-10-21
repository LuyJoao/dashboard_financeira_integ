// Dados falsos no formato da aba "Base" da planilha. Troque por api.get("/api/lancamentos") quando o back-end existir.
export type Lancamento = {
  id: number;
  data: string; // AAAA-MM-DD
  banco: "Caixa" | "Unicred" | "Itaú";
  categoria: string;
  tipo: "Receita" | "Despesa" | "Investimento";
  descricao: string;
  valor: number; // centavos, com sinal
};

const DADOS: Lancamento[] = [
  { id: 1, data: "2026-01-05", banco: "Unicred", categoria: "Vendas Bazar", tipo: "Receita", descricao: "Depósito vendas do bazar", valor: 125000 },
  { id: 2, data: "2026-01-08", banco: "Caixa", categoria: "Insumos Laboratório", tipo: "Despesa", descricao: "Compra de reagentes", valor: -48790 },
  { id: 3, data: "2026-01-12", banco: "Itaú", categoria: "Tarifas Bancárias", tipo: "Despesa", descricao: "Tarifa mensal", valor: -8000 },
  { id: 4, data: "2026-01-15", banco: "Unicred", categoria: "Aplicação Financeira", tipo: "Investimento", descricao: "Aplicação", valor: -21500000 },
  { id: 5, data: "2026-01-20", banco: "Itaú", categoria: "Aplicação Financeira", tipo: "Receita", descricao: "Rendimento", valor: 5714 },
  { id: 6, data: "2026-02-03", banco: "Caixa", categoria: "Taxa de Incubação", tipo: "Receita", descricao: "Taxa de incubação", valor: 5000 },
  { id: 7, data: "2026-02-10", banco: "Unicred", categoria: "Internet/Telecom", tipo: "Despesa", descricao: "Internet do mês", valor: -19990 },
  { id: 8, data: "2026-02-18", banco: "Caixa", categoria: "Análises de Águas", tipo: "Receita", descricao: "Análise de água", valor: 65000 },
  { id: 9, data: "2026-03-02", banco: "Unicred", categoria: "Vendas Bazar", tipo: "Receita", descricao: "Depósito vendas do bazar", valor: 13554200 },
  { id: 10, data: "2026-03-09", banco: "Caixa", categoria: "Serviços Contábeis", tipo: "Despesa", descricao: "Honorários contábeis", valor: -120000 },
  { id: 11, data: "2026-04-07", banco: "Unicred", categoria: "Aplicação Financeira", tipo: "Investimento", descricao: "Aplicação", valor: -30000000 },
  { id: 12, data: "2026-04-14", banco: "Itaú", categoria: "Tarifas Bancárias", tipo: "Despesa", descricao: "Tarifa PIX", valor: -2002 },
  { id: 13, data: "2026-05-14", banco: "Caixa", categoria: "Convênio/Bolsas", tipo: "Despesa", descricao: "Bolsa de pesquisa", valor: -400000 },
  { id: 14, data: "2026-06-11", banco: "Unicred", categoria: "Aplicação Financeira", tipo: "Receita", descricao: "Resgate", valor: 2000001 },
  { id: 15, data: "2026-06-25", banco: "Caixa", categoria: "Vendas Bazar", tipo: "Receita", descricao: "Venda de itens do bazar", valor: 87450 },
];

// "simular" permite testar os estados: ?simular=erro | vazio | lento
export async function buscarLancamentos(simular = ""): Promise<Lancamento[]> {
  await new Promise((r) => setTimeout(r, simular === "lento" ? 3000 : 600));
  if (simular === "erro") throw new Error("falha simulada");
  return simular === "vazio" ? [] : DADOS;
}
