import type { Titulo, TituloEdicao } from "../api/titulos";
import { hojeISO } from "../lib/lancamentos";
import { somaDias } from "../lib/titulos";
import { nomeDaEmpresaMock } from "./empresas";

// As datas são relativas a HOJE, para a demonstração sempre ter títulos vencidos, a vencer e pagos.
const d = (n: number) => somaDias(hojeISO(), n);
type Base = Omit<Titulo, "empresa_nome">;

let TITULOS: Base[] = [
  { id: 1, tipo: "pagar", empresa_id: 3, forma: "NF", numero: "4821", descricao: "Reagentes de laboratório", valor: 125000, vencimento: d(-12), pago_em: null },
  { id: 2, tipo: "pagar", empresa_id: 5, forma: "Boleto", numero: "0310", descricao: "Internet do mês", valor: 19990, vencimento: d(-3), pago_em: null },
  { id: 3, tipo: "pagar", empresa_id: 4, forma: "NF", numero: "9087", descricao: "Material de escritório", valor: 34500, vencimento: d(5), pago_em: null },
  { id: 4, tipo: "pagar", empresa_id: 6, forma: "Boleto", numero: "0412", descricao: "Honorários contábeis", valor: 120000, vencimento: d(20), pago_em: null },
  { id: 5, tipo: "pagar", empresa_id: 3, forma: "NF", numero: "4733", descricao: "Reagentes de laboratório", valor: 98000, vencimento: d(-30), pago_em: d(-28) },
  { id: 6, tipo: "pagar", empresa_id: 5, forma: "Boleto", numero: "0309", descricao: "Internet do mês", valor: 19990, vencimento: d(-33), pago_em: d(-33) },
  { id: 7, tipo: "receber", empresa_id: 1, forma: "NF", numero: "112", descricao: "Taxa de incubação", valor: 5000, vencimento: d(2), pago_em: null },
  { id: 8, tipo: "receber", empresa_id: 2, forma: "Boleto", numero: "087", descricao: "Taxa de incubação", valor: 50000, vencimento: d(-8), pago_em: null },
  { id: 9, tipo: "receber", empresa_id: 1, forma: "NF", numero: "109", descricao: "Taxa de incubação", valor: 5000, vencimento: d(-28), pago_em: d(-26) },
  { id: 10, tipo: "pagar", empresa_id: 4, forma: "Boleto", numero: "0555", descricao: "Material de limpeza", valor: 8700, vencimento: d(0), pago_em: null },
];
let proximoId = 11;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const comNome = (t: Base): Titulo => ({ ...t, empresa_nome: nomeDaEmpresaMock(t.empresa_id) });

// ?simular=erro | vazio | lento testa os estados. Descrição com "falha" testa erro ao salvar.
export async function listarTitulosMock(simular = ""): Promise<Titulo[]> {
  await esperar(simular === "lento" ? 3000 : 600);
  if (simular === "erro") throw new Error("falha simulada");
  return simular === "vazio" ? [] : TITULOS.map(comNome);
}

export async function criarTituloMock(dados: TituloEdicao): Promise<Titulo> {
  await esperar(500);
  if (dados.descricao.toLowerCase().includes("falha")) throw new Error("falha simulada");
  const novo: Base = { id: proximoId++, ...dados };
  TITULOS = [...TITULOS, novo];
  return comNome(novo);
}

export async function atualizarTituloMock(id: number, dados: TituloEdicao): Promise<Titulo> {
  await esperar(500);
  if (dados.descricao.toLowerCase().includes("falha")) throw new Error("falha simulada");
  const i = TITULOS.findIndex((t) => t.id === id);
  if (i < 0) throw new Error("título não encontrado");
  TITULOS[i] = { id, ...dados };
  return comNome(TITULOS[i]);
}

export async function excluirTituloMock(id: number): Promise<void> {
  await esperar(500);
  TITULOS = TITULOS.filter((t) => t.id !== id);
}
