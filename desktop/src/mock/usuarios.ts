import type { Usuario, UsuarioEdicao, UsuarioNovo } from "../api/usuarios";

let USUARIOS: Usuario[] = [
  { id: 1, nome: "Administrador", email: "admin@exemplo.com", role: "admin", ativo: true },
  { id: 2, nome: "Perfil INTEG", email: "perfil.integ@exemplo.com", role: "user", ativo: true },
  { id: 3, nome: "Estagiário Antigo", email: "antigo@exemplo.com", role: "user", ativo: false },
];
let proximoId = 4;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function listarUsuariosMock(): Promise<Usuario[]> {
  await esperar(400);
  return USUARIOS.map((u) => ({ ...u }));
}

export async function criarUsuarioMock(d: UsuarioNovo): Promise<Usuario> {
  await esperar(500);
  const email = d.email.trim().toLowerCase();
  if (USUARIOS.some((u) => u.email === email)) throw new Error("E-mail já cadastrado");
  const novo: Usuario = { id: proximoId++, nome: d.nome.trim(), email, role: d.role, ativo: true };
  USUARIOS = [...USUARIOS, novo];
  return { ...novo };
}

export async function atualizarUsuarioMock(id: number, d: UsuarioEdicao): Promise<Usuario> {
  await esperar(400);
  const i = USUARIOS.findIndex((u) => u.id === id);
  if (i < 0) throw new Error("Usuário não encontrado");
  const atual = USUARIOS[i];
  const admins = USUARIOS.filter((u) => u.role === "admin" && u.ativo);
  const ficaSemAdmin = atual.role === "admin" && atual.ativo && admins.length === 1 && (d.role === "user" || d.ativo === false);
  if (ficaSemAdmin) throw new Error("Não é possível remover o último administrador ativo.");
  USUARIOS[i] = { ...atual, ...d };
  return { ...USUARIOS[i] };
}

export async function redefinirSenhaMock(id: number, nova: string): Promise<void> {
  await esperar(400);
  if (!USUARIOS.some((u) => u.id === id)) throw new Error("Usuário não encontrado");
  if (nova.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
}
