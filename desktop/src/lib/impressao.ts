import { useSyncExternalStore } from "react";

// Enquanto o PDF é gerado, as tabelas mostram todas as linhas em vez de só a página atual.
let ativo = false;
const ouvintes = new Set<() => void>();
const definir = (v: boolean) => {
  ativo = v;
  ouvintes.forEach((f) => f());
};

export const modoImpressaoAtivo = () => ativo;

export function usarModoImpressao(): boolean {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => void ouvintes.delete(f);
    },
    () => ativo
  );
}

const doisQuadros = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function comModoImpressao<T>(acao: () => Promise<T> | T): Promise<T> {
  definir(true);
  try {
    await Promise.race([doisQuadros(), esperar(300)]); // o segundo evita travar se a janela estiver em segundo plano
    return await acao();
  } finally {
    definir(false);
  }
}

// Nome sugerido: integ-<tela>-AAAA-MM-DD.pdf
const TELAS: Record<string, string> = {
  "/": "dashboard",
  "/lancamentos": "lancamentos",
  "/contas": "contas",
  "/empresas": "empresas",
  "/saldos": "saldos",
  "/importar": "importacao",
  "/categorias": "categorias",
  "/usuarios": "usuarios",
};

export function nomeDoPdf(caminho: string, hojeISO: string): string {
  const tela = TELAS[caminho] ?? (caminho.replace(/^\/+/, "").split("/")[0] || "relatorio").replace(/[^\w-]/g, "");
  return `integ-${tela}-${hojeISO}.pdf`;
}
