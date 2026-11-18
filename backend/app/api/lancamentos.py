from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Lancamento, Usuario
from ..schemas import FiltrosOut, LancamentoEdicaoIn, LancamentoOut
from ..services.consultas import TIPOS, FiltrosLancamento, condicoes, filtros_lancamento
from ..services.validacoes import validar_lancamento

router = APIRouter(prefix="/api/lancamentos", tags=["lancamentos"], dependencies=[Depends(usuario_atual)])


def lancamento_out(l: Lancamento) -> LancamentoOut:
    return LancamentoOut(
        id=l.id,
        data=l.data,
        banco=l.banco,
        categoria=l.categoria,
        tipo=l.tipo,
        descricao=l.descricao,
        observacao=l.observacao or "",
        valor=l.valor_centavos,
    )


def _aplicar_edicao(l: Lancamento, dados: LancamentoEdicaoIn, conta_id: int, categoria_id: int) -> None:
    l.data = dados.data
    l.competencia = dados.data.strftime("%Y-%m")
    l.banco = dados.banco.strip()
    l.conta_id = conta_id
    l.categoria_id = categoria_id
    l.categoria = dados.categoria.strip()
    l.tipo = dados.tipo
    l.descricao = dados.descricao.strip()
    l.observacao = dados.observacao.strip()
    l.valor_centavos = dados.valor


@router.get("", response_model=list[LancamentoOut])
def listar(f: FiltrosLancamento = Depends(filtros_lancamento), db: Session = Depends(get_db)):
    linhas = db.scalars(
        select(Lancamento)
        .where(*condicoes(f))
        .order_by(Lancamento.data.desc(), Lancamento.id.desc())
    ).all()
    return [lancamento_out(l) for l in linhas]


@router.get("/filtros", response_model=FiltrosOut)
def opcoes_de_filtro(db: Session = Depends(get_db)):
    from ..models import Categoria, Conta

    return FiltrosOut(
        bancos=list(db.scalars(select(Conta.nome).order_by(Conta.id))),
        categorias=list(db.scalars(select(Categoria.nome).order_by(Categoria.nome))),
        tipos=list(TIPOS),
    )


@router.get("/categorias")
def por_categoria(f: FiltrosLancamento = Depends(filtros_lancamento), db: Session = Depends(get_db)):
    from sqlalchemy import case, func

    from ..models import Lancamento

    receitas = func.coalesce(func.sum(case((Lancamento.valor_centavos > 0, Lancamento.valor_centavos), else_=0)), 0)
    despesas = func.coalesce(func.sum(case((Lancamento.valor_centavos < 0, Lancamento.valor_centavos), else_=0)), 0)
    rows = db.execute(
        select(Lancamento.categoria, receitas, despesas)
        .where(*condicoes(f))
        .group_by(Lancamento.categoria)
    ).all()
    return [
        {
            "categoria": nome,
            "receitas": int(receitas_total),
            "despesas": int(despesas_total),
            "despesas_abs": -int(despesas_total),
            "total_movimentado_abs": int(receitas_total) - int(despesas_total),
        }
        for nome, receitas_total, despesas_total in rows
    ]


@router.post("", response_model=LancamentoOut, status_code=201)
def criar(dados: LancamentoEdicaoIn, db: Session = Depends(get_db), _: Usuario = Depends(usuario_atual)):
    conta, categoria = validar_lancamento(db, dados)
    lancamento = Lancamento(
        importacao_id=None,
        conta_id=conta.id,
        categoria_id=categoria.id,
        competencia=dados.data.strftime("%Y-%m"),
        data=dados.data,
        banco=conta.nome,
        tipo=dados.tipo,
        categoria=categoria.nome,
        descricao=dados.descricao.strip(),
        observacao=dados.observacao.strip(),
        documento=None,
        cod_operacao=None,
        valor_centavos=dados.valor,
        saldo_apos_centavos=None,
        origem="manual",
        assinatura=None,
        ordem_repeticao=None,
        ordem_extrato=None,
    )
    db.add(lancamento)
    db.commit()
    db.refresh(lancamento)
    return lancamento_out(lancamento)


@router.patch("/{lancamento_id}", response_model=LancamentoOut)
def editar(lancamento_id: int, dados: LancamentoEdicaoIn, db: Session = Depends(get_db)):
    lancamento = db.get(Lancamento, lancamento_id)
    if not lancamento:
        raise HTTPException(404, "Lançamento não encontrado.")
    conta, categoria = validar_lancamento(db, dados)
    _aplicar_edicao(lancamento, dados, conta.id, categoria.id)
    db.commit()
    db.refresh(lancamento)
    return lancamento_out(lancamento)


@router.delete("/{lancamento_id}", status_code=204)
def excluir(lancamento_id: int, db: Session = Depends(get_db)):
    lancamento = db.get(Lancamento, lancamento_id)
    if not lancamento:
        raise HTTPException(404, "Lançamento não encontrado.")
    db.delete(lancamento)
    db.commit()
    return Response(status_code=204)
