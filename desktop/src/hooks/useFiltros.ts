import { useSearchParams } from "react-router-dom";

// Guarda os filtros na URL (#/lancamentos?banco=Itaú&categoria=...): o link pode ser
// compartilhado e o botão voltar funciona. Depois, esses mesmos valores vão como parâmetros para a API.
export function useFiltros() {
  const [params, setParams] = useSearchParams();

  const get = (chave: string) => params.get(chave) ?? "";

  const set = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo, { replace: true });
  };

  const limpar = () => setParams({}, { replace: true });

  return { get, set, limpar, temFiltro: Array.from(params.keys()).length > 0 };
}
