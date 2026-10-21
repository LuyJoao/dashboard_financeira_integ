import { DragEvent, useEffect, useRef, useState } from "react";
import { btnCls } from "./ui";

type Props = { onArquivo: (arquivo: File) => void; disabled?: boolean; maxMB?: number };

export function UploadArquivo({ onArquivo, disabled, maxMB = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const [erro, setErro] = useState("");

  // Sem isto, soltar um arquivo fora da área faria o Electron abri-lo dentro da janela do app.
  useEffect(() => {
    const bloquear = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", bloquear);
    return () => {
      window.removeEventListener("dragover", bloquear);
      window.removeEventListener("drop", bloquear);
    };
  }, []);

  function validar(f: File): string {
    if (!/\.(xlsx|xls)$/i.test(f.name)) return "Envie um arquivo Excel (.xlsx ou .xls).";
    if (f.size > maxMB * 1024 * 1024) return `O arquivo passa de ${maxMB} MB.`;
    return "";
  }

  function receber(f?: File) {
    if (!f) return;
    const msg = validar(f);
    setErro(msg);
    if (!msg) onArquivo(f);
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setSobre(false);
    if (!disabled) receber(e.dataTransfer.files[0]);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={aoSoltar}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center text-sm ${
          sobre ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <p className="font-medium">Arraste a planilha Excel para cá</p>
        <p className="text-slate-500">ou</p>
        <button type="button" className={btnCls} disabled={disabled} onClick={() => inputRef.current?.click()}>
          Escolher arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(e) => {
            receber(e.target.files?.[0]);
            e.target.value = ""; // permite escolher o mesmo arquivo de novo
          }}
        />
        <p className="text-xs text-slate-400">.xlsx ou .xls, até {maxMB} MB</p>
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
