// Guarda o que o usuário informou na tela de Saldos (só nos dados de exemplo; no sistema isso vai para o banco).
export type OverrideSaldo = { saldo_inicial: number; saldo_extrato: number | null };

const saldos = new Map<string, OverrideSaldo>();
const aplicado = new Map<string, number>();

const chave = (mes: string, conta: string) => `${mes}|${conta}`;

export const obterOverrideSaldo = (mes: string, conta: string) => saldos.get(chave(mes, conta));
export const definirOverrideSaldo = (mes: string, conta: string, ov: OverrideSaldo) => void saldos.set(chave(mes, conta), ov);

export const obterOverrideAplicado = (mes: string) => aplicado.get(mes);
// null = voltar ao saldo aplicado calculado
export const definirOverrideAplicado = (mes: string, valor: number | null) => void (valor === null ? aplicado.delete(mes) : aplicado.set(mes, valor));
