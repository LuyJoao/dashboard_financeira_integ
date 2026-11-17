import { api } from "./client";
import { atualizarUsuarioMock, criarUsuarioMock, listarUsuariosMock, redefinirSenhaMock } from "../mock/usuarios";

// ---------- Contrato com o back-end (tudo SOMENTE ADMIN) ----------
// GET   /api/usuarios                          -> Usuario[]                       (já existe)
// POST  /api/usuarios                          -> Usuario   (UsuarioNovo)         (já existe)
// PATCH /api/usuarios/{id}                     -> Usuario   (UsuarioEdicao)       (B8)
// POST  /api/usuarios/{id}/redefinir-senha     -> 204       ({ nova_senha })      (B8)
// O back-end deve impedir: o admin desativar ou rebaixar a si mesmo e remover o último admin ativo.
// Usuário desativado não consegue entrar (login recusado) e o token dele deixa de valer.

export type Perfil = "admin" | "user";
export type Usuario = { id: number; nome: string; email: string; role: Perfil; ativo: boolean };
export type UsuarioNovo = { nome: string; email: string; senha: string; role: Perfil };
export type UsuarioEdicao = { nome?: string; role?: Perfil; ativo?: boolean };

const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function listarUsuarios(): Promise<Usuario[]> {
  if (USAR_MOCK) return listarUsuariosMock();
  return (await api.get<Usuario[]>("/api/usuarios")).data;
}

export async function criarUsuario(dados: UsuarioNovo): Promise<Usuario> {
  if (USAR_MOCK) return criarUsuarioMock(dados);
  return (await api.post<Usuario>("/api/usuarios", dados)).data;
}

export async function atualizarUsuario(id: number, dados: UsuarioEdicao): Promise<Usuario> {
  if (USAR_MOCK) return atualizarUsuarioMock(id, dados);
  return (await api.patch<Usuario>(`/api/usuarios/${id}`, dados)).data;
}

export async function redefinirSenhaUsuario(id: number, nova_senha: string): Promise<void> {
  if (USAR_MOCK) return redefinirSenhaMock(id, nova_senha);
  await api.post(`/api/usuarios/${id}/redefinir-senha`, { nova_senha });
}
