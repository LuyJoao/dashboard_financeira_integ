import { api } from "./client";
import { confirmarMock, listarMock, previaMock } from "./importacoesMock";

// ---------- Contrato com o back-end (combinar com quem faz a API) ----------
// POST /api/importacoes/previa    (multipart, campo "arquivo")  -> Previa   (lê e valida; NÃO grava)
// POST /api/importacoes/confirmar { token }                      -> Importacao (grava as linhas válidas)
// GET  /api/importacoes                                          -> Importacao[] (histórico)

export type ErroLinha = { linha: number; coluna: string; mensagem: string };

export type LinhaPrevia = {
  linha: number; // número da linha na planilha
  data: string; // AAAA-MM-DD
  banco: string;
  categoria: string;
  tipo: string;
  descricao: string;
  valor: number; // centavos, com sinal
};

export type Previa = {
  token: string; // identifica esta prévia na hora de confirmar
  arquivo_nome: string;
  total_linhas: number;
  linhas_ok: number;
  linhas_erro: number;
  periodos: string[]; // meses encontrados, ex.: ["Jan/26", "Fev/26"]
  amostra: LinhaPrevia[]; // só as primeiras linhas válidas
  erros: ErroLinha[];
};

export type Importacao = {
  id: number;
  arquivo_nome: string;
  enviado_em: string; // data e hora com fuso
  usuario_nome: string;
  linhas_total: number;
  linhas_ok: number;
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

export async function confirmarImportacao(token: string): Promise<Importacao> {
  if (USAR_MOCK) return confirmarMock(token);
  return (await api.post<Importacao>("/api/importacoes/confirmar", { token })).data;
}

export async function listarImportacoes(): Promise<Importacao[]> {
  if (USAR_MOCK) return listarMock();
  return (await api.get<Importacao[]>("/api/importacoes")).data;
}
