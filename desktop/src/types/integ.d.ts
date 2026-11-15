// Ponte criada pelo Electron (electron/preload.cjs). No navegador comum ela não existe.
interface Window {
  integ?: {
    salvarPdf: (nomeSugerido: string) => Promise<{ ok: boolean; cancelado?: boolean; caminho?: string; erro?: string }>;
    token: {
      ler: () => Promise<string | null>;
      salvar: (token: string) => Promise<boolean>; // false = o sistema não oferece criptografia; o token fica só na memória
      apagar: () => Promise<boolean>;
    };
  };
}
