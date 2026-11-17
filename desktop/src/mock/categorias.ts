import type { Categoria } from "../api/categorias";
import { DADOS_DASHBOARD } from "./dashboardDados";
import { listarMock } from "./lancamentos";

// Nomes da planilha real mais os usados nos lançamentos de exemplo.
const EXTRAS = ["Convênio/Bolsas", "Insumos Laboratório", "Internet/Telecom", "Serviços Contábeis", "Tarifas Bancárias", "Taxa de Incubação", "Vendas Bazar", "Análises de Águas"];
const nomes = Array.from(new Set([...DADOS_DASHBOARD.categorias, ...EXTRAS])).sort((a, b) => a.localeCompare(b));

let CATEGORIAS = nomes.map((nome, i) => ({ id: i + 1, nome, sistema: nome === "Aplicação Financeira" }));
let proximoId = CATEGORIAS.length + 1;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Em uso = quantos lançamentos de exemplo usam a categoria
async function emUso(nome: string) {
  return (await listarMock()).filter((l) => l.categoria === nome).length;
}
const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function listarCategoriasMock(): Promise<Categoria[]> {
  await esperar(300);
  const lancs = await listarMock();
  return CATEGORIAS.map((c) => ({ ...c, em_uso: lancs.filter((l) => l.categoria === c.nome).length }));
}

export async function criarCategoriaMock(nome: string): Promise<Categoria> {
  await esperar(400);
  if (CATEGORIAS.some((c) => igual(c.nome, nome))) throw new Error("Já existe uma categoria com esse nome.");
  const nova = { id: proximoId++, nome: nome.trim(), sistema: false };
  CATEGORIAS = [...CATEGORIAS, nova].sort((a, b) => a.nome.localeCompare(b.nome));
  return { ...nova, em_uso: 0 };
}

// No mock, renomear não altera os lançamentos de exemplo; no back-end a relação por id faz isso sozinha.
export async function atualizarCategoriaMock(id: number, nome: string): Promise<Categoria> {
  await esperar(400);
  const c = CATEGORIAS.find((x) => x.id === id);
  if (!c) throw new Error("Categoria não encontrada.");
  if (c.sistema) throw new Error("A categoria do sistema não pode ser renomeada.");
  if (CATEGORIAS.some((x) => x.id !== id && igual(x.nome, nome))) throw new Error("Já existe uma categoria com esse nome.");
  c.nome = nome.trim();
  CATEGORIAS = [...CATEGORIAS].sort((a, b) => a.nome.localeCompare(b.nome));
  return { ...c, em_uso: await emUso(c.nome) };
}

export async function excluirCategoriaMock(id: number): Promise<void> {
  await esperar(400);
  const c = CATEGORIAS.find((x) => x.id === id);
  if (!c) throw new Error("Categoria não encontrada.");
  if (c.sistema) throw new Error("A categoria do sistema não pode ser excluída.");
  const n = await emUso(c.nome);
  if (n > 0) throw new Error(`Categoria em uso por ${n} lançamento(s). Não pode ser excluída.`);
  CATEGORIAS = CATEGORIAS.filter((x) => x.id !== id);
}
