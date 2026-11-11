import type { ConfirmacaoImportacao, Importacao, Previa } from "./importacoes";

// Dados falsos gerados a partir da planilha real. Como testar:
//  - qualquer .xlsx          -> prévia com 3 linhas com erro (linhas 187, 195 e 320 da Base), para corrigir na tela
//  - nome contendo "limpo"   -> prévia sem erros
//  - nome contendo "falha"   -> erro do servidor
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE = {
 "periodos": [
  "Mai/26",
  "Jun/26"
 ],
 "total": 152,
 "novas": 22,
 "atualizadas": 2,
 "iguais": 125,
 "categorias": [
  "Ajustes de Conta",
  "Análises de Águas",
  "Aplicação Financeira",
  "Convênio/Bolsas Palmital",
  "Despesas de Copa",
  "Fornecedores/Outros",
  "Insumos Laboratório",
  "Internet/Telecom",
  "Manutenção/Reforma",
  "Serviços Contábeis",
  "Tarifas Bancárias",
  "Taxa de Incubação",
  "Vendas Bazar"
 ],
 "amostra": [
  {
   "linha": 176,
   "situacao": "nova",
   "data": "2026-05-04",
   "banco": "104 - Caixa",
   "categoria": "Taxa de Incubação",
   "tipo": "Receita",
   "descricao": "Taxa de Incubação",
   "valor": 5000
  },
  {
   "linha": 177,
   "situacao": "nova",
   "data": "2026-05-04",
   "banco": "104 - Caixa",
   "categoria": "Despesas de Copa",
   "tipo": "Despesa",
   "descricao": "Supermill Supermercados",
   "valor": -28423
  },
  {
   "linha": 178,
   "situacao": "nova",
   "data": "2026-05-04",
   "banco": "104 - Caixa",
   "categoria": "Tarifas Bancárias",
   "tipo": "Despesa",
   "descricao": "Tarifa PIX",
   "valor": -252
  },
  {
   "linha": 179,
   "situacao": "nova",
   "data": "2026-05-05",
   "banco": "104 - Caixa",
   "categoria": "Internet/Telecom",
   "tipo": "Despesa",
   "descricao": "Zazz Internet Ltda",
   "valor": -20990
  },
  {
   "linha": 180,
   "situacao": "nova",
   "data": "2026-05-08",
   "banco": "104 - Caixa",
   "categoria": "Fornecedores/Outros",
   "tipo": "Despesa",
   "descricao": "Comercial Álvaro de Gás Ltda",
   "valor": -25200
  },
  {
   "linha": 181,
   "situacao": "nova",
   "data": "2026-05-08",
   "banco": "104 - Caixa",
   "categoria": "Tarifas Bancárias",
   "tipo": "Despesa",
   "descricao": "Tarifa PIX",
   "valor": -224
  },
  {
   "linha": 182,
   "situacao": "atualizada",
   "data": "2026-05-11",
   "banco": "104 - Caixa",
   "categoria": "Taxa de Incubação",
   "tipo": "Receita",
   "descricao": "Taxa de Incubação",
   "valor": 10000
  },
  {
   "linha": 183,
   "situacao": "atualizada",
   "data": "2026-05-11",
   "banco": "104 - Caixa",
   "categoria": "Tarifas Bancárias",
   "tipo": "Despesa",
   "descricao": "Tarifa PIX",
   "valor": -89
  }
 ],
 "detalhe": [
  {
   "linha": 182,
   "descricao": "Taxa de Incubação",
   "mudancas": [
    "Valor: R$ 90,00 → R$ 100,00"
   ]
  },
  {
   "linha": 183,
   "descricao": "Tarifa PIX",
   "mudancas": [
    "Valor: R$ 9,11 → R$ 0,89"
   ]
  }
 ],
 "erros": [
  {
   "linha": 187,
   "coluna": "Data",
   "mensagem": "Data inválida: \"14//05/26\"",
   "bruto": {
    "data": "14//05/26",
    "banco": "104 - Caixa",
    "categoria": "Convênio/Bolsas Palmital",
    "tipo": "Despesa",
    "descricao": "Ref. Cv 03/26 - Palmital",
    "observacao": "Bolsa Wellington Barbosa da Silva",
    "valor": -400000
   }
  },
  {
   "linha": 195,
   "coluna": "Tipo",
   "mensagem": "Tipo \"Despesa\" com valor positivo (R$ 650,00)",
   "bruto": {
    "data": "2026-05-15",
    "banco": "104 - Caixa",
    "categoria": "Análises de Águas",
    "tipo": "Despesa",
    "descricao": "Carlos Alberto Vaz",
    "observacao": "Ref. Análise de combustíveis",
    "valor": 65000
   }
  },
  {
   "linha": 320,
   "coluna": "Observação",
   "mensagem": "Em \"Aplicação Financeira\", a Observação deve ser Investimento, Rendimento ou Resgate.",
   "bruto": {
    "data": "2026-06-19",
    "banco": "136 - Unicred",
    "categoria": "Aplicação Financeira",
    "tipo": "Receita",
    "descricao": "Resgate Aplicação",
    "observacao": "",
    "valor": 2000001
   }
  }
 ],
 "saldosErros": [
  {
   "mes": "Mai/26",
   "conta": "104 - Caixa",
   "entradas": 1555000,
   "saidas": -1007100,
   "saldo_inicial": 1224614,
   "saldo_final_informado": null
  },
  {
   "mes": "Mai/26",
   "conta": "136 - Unicred",
   "entradas": 5168883,
   "saidas": -8656409,
   "saldo_inicial": 4370670,
   "saldo_final_informado": null
  },
  {
   "mes": "Mai/26",
   "conta": "341 - Itaú",
   "entradas": 6500,
   "saidas": -16900,
   "saldo_inicial": 46959,
   "saldo_final_informado": null
  },
  {
   "mes": "Jun/26",
   "conta": "104 - Caixa",
   "entradas": 1549600,
   "saidas": -1616814,
   "saldo_inicial": 1437514,
   "saldo_final_informado": null
  },
  {
   "mes": "Jun/26",
   "conta": "136 - Unicred",
   "entradas": 1678547,
   "saidas": -3971000,
   "saldo_inicial": 883144,
   "saldo_final_informado": null
  },
  {
   "mes": "Jun/26",
   "conta": "341 - Itaú",
   "entradas": 6601,
   "saidas": -16900,
   "saldo_inicial": 36559,
   "saldo_final_informado": null
  }
 ],
 "saldosLimpo": [
  {
   "mes": "Mai/26",
   "conta": "104 - Caixa",
   "entradas": 1620000,
   "saidas": -1407100,
   "saldo_inicial": 1224614,
   "saldo_final_informado": null
  },
  {
   "mes": "Mai/26",
   "conta": "136 - Unicred",
   "entradas": 5168883,
   "saidas": -8656409,
   "saldo_inicial": 4370670,
   "saldo_final_informado": null
  },
  {
   "mes": "Mai/26",
   "conta": "341 - Itaú",
   "entradas": 6500,
   "saidas": -16900,
   "saldo_inicial": 46959,
   "saldo_final_informado": null
  },
  {
   "mes": "Jun/26",
   "conta": "104 - Caixa",
   "entradas": 1549600,
   "saidas": -1616814,
   "saldo_inicial": 1437514,
   "saldo_final_informado": null
  },
  {
   "mes": "Jun/26",
   "conta": "136 - Unicred",
   "entradas": 3678548,
   "saidas": -3971000,
   "saldo_inicial": 883144,
   "saldo_final_informado": null
  },
  {
   "mes": "Jun/26",
   "conta": "341 - Itaú",
   "entradas": 6601,
   "saidas": -16900,
   "saldo_inicial": 36559,
   "saldo_final_informado": null
  }
 ],
 "aplicado": [
  {
   "mes": "Mai/26",
   "saldo_inicial": 51199998,
   "saldo_final": null
  },
  {
   "mes": "Jun/26",
   "saldo_inicial": 51199998,
   "saldo_final": null
  }
 ]
};

let proximoId = 4;
const historico: Importacao[] = [
  { id: 3, arquivo_nome: "Base_Maio_2026.xlsx", enviado_em: "2026-06-03T14:20:00-03:00", usuario_nome: "Administrador", linhas_total: 52, linhas_novas: 52, linhas_atualizadas: 0, linhas_erro: 0, status: "concluida" },
  { id: 2, arquivo_nome: "Base_Abril_2026.xlsx", enviado_em: "2026-05-05T09:42:00-03:00", usuario_nome: "Administrador", linhas_total: 58, linhas_novas: 56, linhas_atualizadas: 0, linhas_erro: 2, status: "concluida_com_erros" },
  { id: 1, arquivo_nome: "Base_Janeiro_2026.xlsx", enviado_em: "2026-02-04T16:05:00-03:00", usuario_nome: "Administrador", linhas_total: 61, linhas_novas: 61, linhas_atualizadas: 0, linhas_erro: 0, status: "concluida" },
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
    total_linhas: BASE.total,
    novas: limpo ? BASE.novas + 5 : BASE.novas,
    atualizadas: limpo ? 0 : BASE.atualizadas,
    iguais: BASE.iguais,
    linhas_erro: limpo ? 0 : BASE.erros.length,
    periodos: BASE.periodos,
    categorias: BASE.categorias,
    amostra: limpo ? BASE.amostra.map((l) => ({ ...l, situacao: "nova" as const })) : (BASE.amostra as Previa["amostra"]),
    atualizadas_detalhe: limpo ? [] : BASE.detalhe,
    erros: limpo ? [] : BASE.erros,
    saldos: limpo ? BASE.saldosLimpo : BASE.saldosErros,
    aplicado: BASE.aplicado,
  };
  pendentes.set(previa.token, previa);
  return previa;
}

export async function confirmarMock(c: ConfirmacaoImportacao): Promise<Importacao> {
  await esperar(800);
  const p = pendentes.get(c.token);
  if (!p) throw new Error("prévia expirada");
  const erroRestante = p.linhas_erro - c.correcoes.length;
  const imp: Importacao = {
    id: proximoId++,
    arquivo_nome: p.arquivo_nome,
    enviado_em: new Date().toISOString(),
    usuario_nome: "Você",
    linhas_total: p.total_linhas,
    linhas_novas: p.novas + c.correcoes.length,
    linhas_atualizadas: p.atualizadas,
    linhas_erro: erroRestante,
    status: erroRestante > 0 ? "concluida_com_erros" : "concluida",
  };
  historico.unshift(imp);
  pendentes.delete(c.token);
  return imp;
}

export async function listarMock(): Promise<Importacao[]> {
  await esperar(400);
  return [...historico];
}
