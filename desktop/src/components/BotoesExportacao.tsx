import { useState } from "react";
import { useLocation } from "react-router-dom";
import "../print.css";
import { comModoImpressao, nomeDoPdf } from "../lib/impressao";
import { hojeISO } from "../lib/lancamentos";
import { btnCls } from "./ui";

type Aviso = { ok: boolean; texto: string } | null;

export function BotoesExportacao() {
  const { pathname } = useLocation();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  async function aoSalvarPdf() {
    setAviso(null);
    setOcupado(true);
    try {
      if (!window.integ) {
        // Navegador comum (sem Electron): usa o diálogo do navegador para salvar como PDF.
        await comModoImpressao(() => window.print());
        return;
      }
      const ponte = window.integ;
      const r = await comModoImpressao(() => ponte.salvarPdf(nomeDoPdf(pathname, hojeISO())));
      if (r.ok) setAviso({ ok: true, texto: `PDF salvo em ${r.caminho}` });
      else if (!r.cancelado) setAviso({ ok: false, texto: r.erro ?? "Não foi possível gerar o PDF." });
    } catch {
      setAviso({ ok: false, texto: "Não foi possível gerar o PDF." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      {aviso && (
        <span className={`max-w-xs truncate text-xs ${aviso.ok ? "text-green-700" : "text-red-600"}`} title={aviso.texto}>
          {aviso.texto}
        </span>
      )}
      <button className={btnCls} onClick={aoSalvarPdf} disabled={ocupado}>
        {ocupado ? "Gerando PDF..." : "Salvar PDF"}
      </button>
    </div>
  );
}
