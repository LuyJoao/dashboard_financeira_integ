import { ReactNode, useEffect } from "react";

export function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  // Esc fecha a janela
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onFechar}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
