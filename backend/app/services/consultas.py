"""Filtros, ordenação, paginação e medidas por categoria, compartilhados pelas rotas de consulta."""
from dataclasses import dataclass
from datetime import date
from math import ceil
from typing import Literal

from fastapi import HTTPException, Query
from sqlalchemy import ColumnElement, case, func, or_

from ..models import Lancamento

TIPOS = ("Receita", "Despesa", "Investimento")
ORDENAVEIS = {
    "data": Lancamento.data,
    "valor": Lancamento.valor_centavos,
    "banco": Lancamento.banco,
    "categoria": Lancamento.categoria,
    "tipo": Lancamento.tipo,
    "descricao": Lancamento.descricao,
}


@dataclass
class FiltrosLancamento:
    banco: str | None = None
    categoria: str | None = None
    tipo: str | None = None
    empresa_id: int | None = None
    de: date | None = None
    ate: date | None = None
    busca: str | None = None


def filtros_lancamento(
    banco: str | None = Query(None, description='Ex.: "104 - Caixa" (use /api/lancamentos/filtros para as opções)'),
    categoria: str | None = None,
    tipo: Literal["Receita", "Despesa", "Investimento"] | None = None,
    empresa_id: int | None = None,
    de: date | None = Query(None, description="Data inicial (AAAA-MM-DD), inclusive"),
    ate: date | None = Query(None, description="Data final (AAAA-MM-DD), inclusive"),
    busca: str | None = Query(None, description="Texto contido na descrição ou na observação"),
) -> FiltrosLancamento:
    if de and ate and de > ate:
        raise HTTPException(422, "A data inicial (de) não pode ser maior que a final (ate).")
    return FiltrosLancamento(banco, categoria, tipo, empresa_id, de, ate, (busca or "").strip() or None)


def condicoes(f: FiltrosLancamento) -> list[ColumnElement[bool]]:
    c: list[ColumnElement[bool]] = []
    if f.banco:
        c.append(Lancamento.banco == f.banco)
    if f.categoria:
        c.append(Lancamento.categoria == f.categoria)
    if f.tipo:
        c.append(Lancamento.tipo == f.tipo)
    if f.empresa_id is not None:
        c.append(Lancamento.empresa_id == f.empresa_id)
    if f.de:
        c.append(Lancamento.data >= f.de)
    if f.ate:
        c.append(Lancamento.data <= f.ate)
    if f.busca:
        txt = f.busca.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        c.append(or_(Lancamento.descricao.ilike(f"%{txt}%", escape="\\"), Lancamento.observacao.ilike(f"%{txt}%", escape="\\")))
    return c


# Mesmas fórmulas da planilha (aba Categorias): receitas = SUMIFS(valor > 0), despesas = SUMIFS(valor < 0),
# despesas (abs) = -despesas, total movimentado (abs) = receitas + despesas (abs).
RECEITAS = func.coalesce(func.sum(case((Lancamento.valor_centavos > 0, Lancamento.valor_centavos), else_=0)), 0)
DESPESAS = func.coalesce(func.sum(case((Lancamento.valor_centavos < 0, Lancamento.valor_centavos), else_=0)), 0)


def medidas(receitas, despesas) -> dict[str, int]:
    r, d = int(receitas), int(despesas)
    return {"receitas": r, "despesas": d, "despesas_abs": -d, "total_movimentado_abs": r - d}


def paginar(total: int, pagina: int, tamanho: int) -> dict[str, int]:
    return {"total": total, "pagina": pagina, "tamanho": tamanho, "paginas": max(1, ceil(total / tamanho))}
