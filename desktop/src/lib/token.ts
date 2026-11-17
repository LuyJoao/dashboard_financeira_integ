// Token de login. No aplicativo instalado (Electron) ele fica criptografado pelo sistema (safeStorage),
// e não mais no localStorage. No navegador (desenvolvimento) continua no localStorage.
// A leitura é síncrona a partir de uma cópia em memória, carregada uma vez ao abrir o aplicativo.
const CHAVE = "token";
let copia: string | null = null;

const ponte = () => window.integ?.token;
const estaNoElectron = () => typeof navigator !== "undefined" && /Electron\//i.test(navigator.userAgent);

export async function carregarToken(): Promise<void> {
  const p = ponte();
  if (p) {
    copia = await p.ler();
    localStorage.removeItem(CHAVE); // sessão antiga, guardada sem criptografia, é descartada
  } else if (estaNoElectron()) {
    copia = null;
    localStorage.removeItem(CHAVE);
  } else {
    copia = localStorage.getItem(CHAVE);
  }
}

export const lerToken = (): string | null => copia;

export async function salvarToken(token: string): Promise<void> {
  copia = token;
  const p = ponte();
  if (p) await p.salvar(token); // se não for possível criptografar, vale só até fechar o aplicativo
  else if (!estaNoElectron()) localStorage.setItem(CHAVE, token);
}

export async function apagarToken(): Promise<void> {
  copia = null;
  const p = ponte();
  if (p) {
    try {
      if (!(await p.apagar())) console.error("O token persistente não foi apagado.");
    } catch (e) {
      console.error("Não foi possível apagar o token persistente:", e);
    }
  }
  else localStorage.removeItem(CHAVE);
}
