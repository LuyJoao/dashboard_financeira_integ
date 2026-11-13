import type { Empresa, EmpresaNova } from "../api/empresas";

let EMPRESAS: Empresa[] = [
  { id: 1, nome: "NanoSphera", tipo: "incubada", cnpj: null },
  { id: 2, nome: "BioVerde Tecnologia", tipo: "incubada", cnpj: null },
  { id: 3, nome: "Química Sul Distribuidora", tipo: "fornecedor", cnpj: null },
  { id: 4, nome: "Papelaria Central", tipo: "fornecedor", cnpj: null },
  { id: 5, nome: "Net Mais Telecom", tipo: "fornecedor", cnpj: null },
  { id: 6, nome: "Contabilidade Horizonte", tipo: "fornecedor", cnpj: null },
];
let proximoId = 7;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function listarEmpresasMock(): Promise<Empresa[]> {
  await esperar(400);
  return [...EMPRESAS];
}

export async function criarEmpresaMock(dados: EmpresaNova): Promise<Empresa> {
  await esperar(500);
  if (EMPRESAS.some((e) => e.nome.trim().toLowerCase() === dados.nome.trim().toLowerCase())) {
    throw new Error("Já existe uma empresa com esse nome.");
  }
  const nova: Empresa = { id: proximoId++, ...dados };
  EMPRESAS = [...EMPRESAS, nova];
  return nova;
}

export const nomeDaEmpresaMock = (id: number) => EMPRESAS.find((e) => e.id === id)?.nome ?? "—";
