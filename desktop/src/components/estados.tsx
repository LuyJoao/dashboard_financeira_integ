import { mensagemErro } from "../api/client";
import { btnCls } from "./ui";

export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-6 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      {texto}
    </div>
  );
}

export function ErroMsg({ erro, onRetry }: { erro: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
      <p>{mensagemErro(erro)}</p>
      {onRetry && (
        <button onClick={onRetry} className={`${btnCls} mt-3`}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">{texto}</div>
  );
}
