// Ponte criada pelo Electron (electron/preload.cjs). No navegador comum ela não existe.
interface Window {
  integ?: {
    salvarPdf: (nomeSugerido: string) => Promise<{ ok: boolean; cancelado?: boolean; caminho?: string; erro?: string }>;
  };
}
