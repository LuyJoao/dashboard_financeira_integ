import type { Importacao, Previa } from "./importacoes";

// Dados falsos. Como testar:
//  - arquivo qualquer .xlsx      -> prévia com 3 linhas com erro (casos reais da planilha)
//  - nome contendo "limpo"       -> prévia sem erros
//  - nome contendo "falha"       -> erro do servidor (para ver o estado de erro)
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

let proximoId = 4;
const historico: Importacao[] = [
  { id: 3, arquivo_nome: "Base_Maio_2026.xlsx", enviado_em: "2026-06-03T14:20:00-03:00", usuario_nome: "Administrador", linhas_total: 52, linhas_ok: 52, linhas_erro: 0, status: "concluida" },
  { id: 2, arquivo_nome: "Base_Abril_2026.xlsx", enviado_em: "2026-05-05T09:42:00-03:00", usuario_nome: "Administrador", linhas_total: 58, linhas_ok: 56, linhas_erro: 2, status: "concluida_com_erros" },
  { id: 1, arquivo_nome: "Base_Janeiro_2026.xlsx", enviado_em: "2026-02-04T16:05:00-03:00", usuario_nome: "Administrador", linhas_total: 61, linhas_ok: 61, linhas_erro: 0, status: "concluida" },
];

const pendentes = new Map<string, Previa>();

export async function previaMock(arquivo: File): Promise<Previa> {
  await esperar(900);
  const nome = arquivo.name.toLowerCase();
  if (nome.includes("falha")) throw new Error("falha simulada");
  const limpo = nome.includes("limpo");
  const previa: Previa = {
    token: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    arquivo_nome: arquivo.name,
    total_linhas: 326,
    linhas_ok: limpo ? 326 : 323,
    linhas_erro: limpo ? 0 : 3,
    periodos: ["Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26", "Jun/26"],
    amostra: [
      { linha: 2, data: "2026-01-05", banco: "Unicred", categoria: "Vendas Bazar", tipo: "Receita", descricao: "Depósito vendas do bazar", valor: 125000 },
      { linha: 3, data: "2026-01-08", banco: "Caixa", categoria: "Insumos Laboratório", tipo: "Despesa", descricao: "Compra de reagentes", valor: -48790 },
      { linha: 4, data: "2026-01-12", banco: "Itaú", categoria: "Tarifas Bancárias", tipo: "Despesa", descricao: "Tarifa mensal", valor: -8000 },
      { linha: 5, data: "2026-01-15", banco: "Unicred", categoria: "Aplicação Financeira", tipo: "Investimento", descricao: "Aplicação", valor: -21500000 },
      { linha: 6, data: "2026-01-20", banco: "Itaú", categoria: "Aplicação Financeira", tipo: "Receita", descricao: "Rendimento", valor: 5714 },
      { linha: 7, data: "2026-02-03", banco: "Caixa", categoria: "Taxa de Incubação", tipo: "Receita", descricao: "Taxa de incubação", valor: 5000 },
      { linha: 8, data: "2026-02-10", banco: "Unicred", categoria: "Internet/Telecom", tipo: "Despesa", descricao: "Internet do mês", valor: -19990 },
      { linha: 9, data: "2026-02-18", banco: "Caixa", categoria: "Análises de Águas", tipo: "Receita", descricao: "Análise de água", valor: 65000 },
    ],
    erros: limpo
      ? []
      : [
          { linha: 174, coluna: "Data", mensagem: "Data 03/03/2026 não pertence ao mês informado (Abr/26)" },
          { linha: 187, coluna: "Data", mensagem: 'Data inválida: "14//05/26"' },
          { linha: 195, coluna: "Tipo", mensagem: 'Tipo "Despesa" com valor positivo (R$ 650,00)' },
        ],
  };
  pendentes.set(previa.token, previa);
  return previa;
}

export async function confirmarMock(token: string): Promise<Importacao> {
  await esperar(800);
  const p = pendentes.get(token);
  if (!p) throw new Error("prévia expirada");
  const imp: Importacao = {
    id: proximoId++,
    arquivo_nome: p.arquivo_nome,
    enviado_em: new Date().toISOString(),
    usuario_nome: "Você",
    linhas_total: p.total_linhas,
    linhas_ok: p.linhas_ok,
    linhas_erro: p.linhas_erro,
    status: p.linhas_erro > 0 ? "concluida_com_erros" : "concluida",
  };
  historico.unshift(imp);
  pendentes.delete(token);
  return imp;
}

export async function listarMock(): Promise<Importacao[]> {
  await esperar(400);
  return [...historico];
}
