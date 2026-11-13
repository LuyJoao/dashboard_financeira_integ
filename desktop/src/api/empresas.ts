import { api } from "./client";
import { criarEmpresaMock, listarEmpresasMock } from "../mock/empresas";

// ---------- Contrato com o back-end ----------
// GET  /api/empresas -> Empresa[]
// POST /api/empresas -> Empresa   (corpo: EmpresaNova). SOMENTE ADMIN: o back-end deve responder 403 para usuário comum.
// O nome da empresa deve ser único (ignorando maiúsculas e minúsculas).

export type TipoEmpresa = "incubada" | "fornecedor";
export type Empresa = { id: number; nome: string; tipo: TipoEmpresa; cnpj: string | null };
export type EmpresaNova = Omit<Empresa, "id">;

const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function listarEmpresas(): Promise<Empresa[]> {
  if (USAR_MOCK) return listarEmpresasMock();
  return (await api.get<Empresa[]>("/api/empresas")).data;
}

export async function criarEmpresa(dados: EmpresaNova): Promise<Empresa> {
  if (USAR_MOCK) return criarEmpresaMock(dados);
  return (await api.post<Empresa>("/api/empresas", dados)).data;
}
