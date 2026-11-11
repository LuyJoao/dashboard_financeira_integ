import { api } from "./client";
import type { LancamentoEdicao } from "./lancamentos";
import { confirmarMock, listarMock, previaMock } from "./importacoesMock";

// ---------- Contrato com o back-end (v2) ----------
// POST /api/importacoes/previa     (multipart, campo "arquivo") -> Previa   (lê, valida e compara com o que já existe; NÃO grava)
// POST /api/importacoes/confirmar  ConfirmacaoImportacao        -> Importacao (grava)
// GET  /api/importacoes                                         -> Importacao[] (histórico)
//
// Reimportação, linha por linha: se não existe é "nova"; se existe e é igual é "igual" (ignorada);
// se existe e é diferente é "atualizada" (a planilha sobrescreve o que está no sistema).
// "Existe" = mesma assinatura de importação (conta, data, descrição original, valor, documento + ordem de repetição).
// A assinatura não muda quando o lançamento é editado. Lançamentos criados à mão não têm assinatura e nunca são alterados.
// Linha excluída no sistema que reaparece na planilha volta como "nova" (o usuário exclui de novo).

// A linha como veio da planilha, para o usuário poder corrigi-la na tela.
export type LinhaBruta = {
  data: string; // pode ser inválida, ex.: "14//05/26"
  banco: string;
  categoria: string;
  tipo: string;
  descricao: string;
  observacao: string;
  valor: number; // centavos, com sinal
};

export type ErroLinha = { linha: number; coluna: string; mensagem: string; bruto: LinhaBruta };

export type LinhaPrevia = {
  linha: number; // linha na planilha
  situacao: "nova" | "atualizada";
  data: string; // AAAA-MM-DD
  banco: string;
  categoria: string;
  tipo: string;
  descricao: string;
  valor: number;
};

export type LinhaAtualizada = { linha: number; descricao: string; mudancas: string[] };

// Soma de entradas e saídas do mês na conta (sem as linhas com erro) e os saldos já conhecidos pelo sistema (ou null).
export type SaldoSugerido = {
  mes: string;
  conta: string;
  entradas: number;
  saidas: number; // negativo
  saldo_inicial: number | null;
  saldo_final_informado: number | null;
};
export type AplicadoSugerido = { mes: string; saldo_inicial: number | null; saldo_final: number | null };

export type Previa = {
  token: string; // identifica esta prévia na hora de confirmar
  arquivo_nome: string;
  total_linhas: number;
  novas: number;
  atualizadas: number;
  iguais: number;
  linhas_erro: number;
  periodos: string[]; // meses encontrados
  categorias: string[]; // categorias que existem no sistema (para a correção)
  amostra: LinhaPrevia[]; // só algumas linhas novas e atualizadas
  atualizadas_detalhe: LinhaAtualizada[];
  erros: ErroLinha[];
  saldos: SaldoSugerido[]; // um por mês e conta
  aplicado: AplicadoSugerido[]; // um por mês
};

export type Correcao = { linha: number; dados: LancamentoEdicao };
export type SaldoInformado = { mes: string; conta: string; saldo_inicial: number; saldo_final_informado: number };
export type AplicadoInformado = { mes: string; saldo_inicial: number; saldo_final: number };

export type ConfirmacaoImportacao = {
  token: string;
  correcoes: Correcao[]; // linhas com erro que o usuário corrigiu na tela
  saldos: SaldoInformado[];
  aplicado: AplicadoInformado[];
};

export type Importacao = {
  id: number;
  arquivo_nome: string;
  enviado_em: string; // data e hora com fuso
  usuario_nome: string;
  linhas_total: number;
  linhas_novas: number;
  linhas_atualizadas: number;
  linhas_erro: number;
  status: "concluida" | "concluida_com_erros";
};

// Enquanto o back-end não existe, usa dados falsos. Para usar a API de verdade: VITE_USE_MOCK=false no desktop/.env
const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function enviarPrevia(arquivo: File): Promise<Previa> {
  if (USAR_MOCK) return previaMock(arquivo);
  const form = new FormData();
  form.append("arquivo", arquivo);
  return (await api.post<Previa>("/api/importacoes/previa", form)).data;
}

export async function confirmarImportacao(confirmacao: ConfirmacaoImportacao): Promise<Importacao> {
  if (USAR_MOCK) return confirmarMock(confirmacao);
  return (await api.post<Importacao>("/api/importacoes/confirmar", confirmacao)).data;
}

export async function listarImportacoes(): Promise<Importacao[]> {
  if (USAR_MOCK) return listarMock();
  return (await api.get<Importacao[]>("/api/importacoes")).data;
}
