from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Empresa, Lancamento
from ..schemas import EmpresaDetalhe, EmpresaOut, EmpresasPagina
from ..services.consultas import paginar
from .lancamentos import lancamento_out

router = APIRouter(prefix="/api/empresas", tags=["empresas"], dependencies=[Depends(usuario_atual)])

DETALHE_MAX = 1000  # lançamentos devolvidos no detalhe (empresas têm poucos: só as taxas de incubação)


def _agregado():
    """Por empresa: quantidade de lançamentos, soma dos valores e data do último."""
    return (
        select(
            Lancamento.empresa_id.label("empresa_id"),
            func.count().label("qtd"),
            func.coalesce(func.sum(Lancamento.valor_centavos), 0).label("total"),
            func.max(Lancamento.data).label("ultimo"),
        )
        .where(Lancamento.empresa_id.is_not(None))
        .group_by(Lancamento.empresa_id)
        .subquery()
    )


def _empresa_out(e: Empresa, qtd, total, ultimo) -> dict:
    return dict(
        id=e.id, nome=e.nome, cnpj=e.cnpj, qtd_lancamentos=int(qtd or 0), total_centavos=int(total or 0),
        ultimo_lancamento=ultimo,
    )


@router.get("", response_model=EmpresasPagina)
def listar(
    busca: str | None = Query(None, description="Parte do nome ou do CNPJ"),
    ordenar_por: Literal["nome", "qtd_lancamentos", "total", "ultimo_lancamento"] = "nome",
    direcao: Literal["asc", "desc"] = "asc",
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    agg = _agregado()
    stmt = select(Empresa, agg.c.qtd, agg.c.total, agg.c.ultimo).outerjoin(agg, agg.c.empresa_id == Empresa.id)
    if busca and busca.strip():
        txt = busca.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Empresa.nome.ilike(f"%{txt}%", escape="\\") | Empresa.cnpj.ilike(f"%{txt}%", escape="\\"))

    coluna = {
        "nome": Empresa.nome,
        "qtd_lancamentos": func.coalesce(agg.c.qtd, 0),
        "total": func.coalesce(agg.c.total, 0),
        "ultimo_lancamento": agg.c.ultimo,
    }[ordenar_por]
    ordem = coluna.asc() if direcao == "asc" else coluna.desc()

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    linhas = db.execute(stmt.order_by(ordem.nulls_last(), Empresa.id).limit(tamanho).offset((pagina - 1) * tamanho)).all()
    return EmpresasPagina(
        itens=[EmpresaOut(**_empresa_out(e, q, t, u)) for e, q, t, u in linhas],
        **paginar(total, pagina, tamanho),
    )


@router.get("/{empresa_id}", response_model=EmpresaDetalhe)
def detalhe(empresa_id: int, db: Session = Depends(get_db)):
    """Dados da empresa e os lançamentos ligados a ela (taxas de incubação), do mais recente ao mais antigo."""
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(404, "Empresa não encontrada")
    qtd, total, ultimo = db.execute(
        select(func.count(), func.coalesce(func.sum(Lancamento.valor_centavos), 0), func.max(Lancamento.data))
        .where(Lancamento.empresa_id == empresa_id)
    ).one()
    lancs = db.scalars(
        select(Lancamento)
        .where(Lancamento.empresa_id == empresa_id)
        .order_by(Lancamento.data.desc(), Lancamento.id.desc())
        .limit(DETALHE_MAX)
    ).all()
    return EmpresaDetalhe(
        **_empresa_out(empresa, qtd, total, ultimo),
        lancamentos=[lancamento_out(l, empresa.nome) for l in lancs],
    )
