from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Empresa, Lancamento
from ..schemas import FiltrosOut, LancamentoOut, LancamentosPagina, ResumoCategoriaOut, TotaisOut
from ..services.consultas import (
    DESPESAS, ORDENAVEIS, RECEITAS, TIPOS, FiltrosLancamento, condicoes, filtros_lancamento, medidas, paginar,
)

router = APIRouter(prefix="/api/lancamentos", tags=["lancamentos"], dependencies=[Depends(usuario_atual)])


def lancamento_out(l: Lancamento, empresa: str | None) -> LancamentoOut:
    return LancamentoOut(
        id=l.id, data=l.data, banco=l.banco, categoria=l.categoria, tipo=l.tipo, descricao=l.descricao,
        valor=l.valor_centavos, empresa_id=l.empresa_id, empresa=empresa,
    )


@router.get("", response_model=LancamentosPagina)
def listar(
    f: FiltrosLancamento = Depends(filtros_lancamento),
    ordenar_por: Literal["data", "valor", "banco", "categoria", "tipo", "descricao"] = "data",
    direcao: Literal["asc", "desc"] = "desc",
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Lançamentos com filtros, ordenação e paginação. Os `totais` cobrem todas as linhas filtradas."""
    cond = condicoes(f)
    coluna = ORDENAVEIS[ordenar_por]
    ordem = coluna.asc() if direcao == "asc" else coluna.desc()

    total = db.scalar(select(func.count()).select_from(Lancamento).where(*cond)) or 0
    r, d = db.execute(select(RECEITAS, DESPESAS).where(*cond)).one()
    linhas = db.execute(
        select(Lancamento, Empresa.nome)
        .outerjoin(Empresa, Empresa.id == Lancamento.empresa_id)
        .where(*cond)
        .order_by(ordem, Lancamento.id.desc() if direcao == "desc" else Lancamento.id.asc())  # desempate estável
        .limit(tamanho)
        .offset((pagina - 1) * tamanho)
    ).all()
    return LancamentosPagina(
        itens=[lancamento_out(l, nome) for l, nome in linhas],
        totais=TotaisOut(**medidas(r, d)),
        **paginar(total, pagina, tamanho),
    )


@router.get("/filtros", response_model=FiltrosOut)
def opcoes_de_filtro(db: Session = Depends(get_db)):
    """Valores existentes para montar os selects de banco e categoria."""
    return FiltrosOut(
        bancos=list(db.scalars(select(Lancamento.banco).distinct().order_by(Lancamento.banco))),
        categorias=list(db.scalars(select(Lancamento.categoria).distinct().order_by(Lancamento.categoria))),
        tipos=list(TIPOS),
    )


@router.get("/categorias", response_model=list[ResumoCategoriaOut])
def por_categoria(f: FiltrosLancamento = Depends(filtros_lancamento), db: Session = Depends(get_db)):
    """Receitas, Despesas, Despesas (abs) e Total Movimentado (abs) por categoria, com os mesmos filtros da listagem."""
    linhas = db.execute(
        select(Lancamento.categoria, RECEITAS, DESPESAS).where(*condicoes(f)).group_by(Lancamento.categoria)
    ).all()
    saida = [ResumoCategoriaOut(categoria=c, **medidas(r, d)) for c, r, d in linhas]
    return sorted(saida, key=lambda x: (-x.total_movimentado_abs, x.categoria))
