from datetime import date

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Categoria, Conta, Empresa, Lancamento
from ..schemas import LancamentoEdicaoIn, TituloIn
from .planilha import CATEGORIA_APLICACAO, OBS_APLICACAO


def categoria_por_nome(db: Session, nome: str) -> Categoria:
    categoria = db.scalar(select(Categoria).where(func.lower(Categoria.nome) == nome.strip().lower()))
    if not categoria:
        raise HTTPException(422, f'Categoria "{nome}" não existe.')
    return categoria


def validar_lancamento(db: Session, dados: LancamentoEdicaoIn) -> tuple[Conta, Categoria]:
    if dados.data < date(2026, 1, 1):
        raise HTTPException(422, "A data do lançamento deve ser a partir de 01/01/2026.")
    conta = db.scalar(select(Conta).where(Conta.nome == dados.banco.strip()))
    if not conta:
        raise HTTPException(422, f'Conta "{dados.banco}" não existe.')
    categoria = categoria_por_nome(db, dados.categoria)
    if dados.valor == 0:
        raise HTTPException(422, "O valor não pode ser zero.")
    if dados.tipo == "Receita" and dados.valor < 0:
        raise HTTPException(422, "Receita com valor negativo.")
    if dados.tipo in ("Despesa", "Investimento") and dados.valor > 0:
        raise HTTPException(422, f"{dados.tipo} com valor positivo.")
    if categoria.nome.casefold() == CATEGORIA_APLICACAO.casefold():
        if dados.observacao not in OBS_APLICACAO:
            raise HTTPException(
                422,
                'Em "Aplicação Financeira", a Observação deve ser Investimento, Rendimento ou Resgate.',
            )
        if dados.observacao == "Investimento" and dados.valor > 0:
            raise HTTPException(422, "Investimento deve ter valor negativo.")
        if dados.observacao != "Investimento" and dados.valor < 0:
            raise HTTPException(422, f"{dados.observacao} deve ter valor positivo.")
    return conta, categoria


def validar_titulo(db: Session, dados: TituloIn, hoje: date) -> Empresa:
    empresa = db.get(Empresa, dados.empresa_id)
    if not empresa:
        raise HTTPException(422, "A empresa informada não existe.")
    if not dados.numero.strip():
        raise HTTPException(422, "Informe o número do documento.")
    if dados.valor <= 0:
        raise HTTPException(422, "O valor deve ser maior que zero.")
    if dados.pago_em and dados.pago_em > hoje:
        raise HTTPException(422, "A data do pagamento não pode ser futura.")
    return empresa


def categoria_em_uso(db: Session, categoria: Categoria) -> int:
    return db.query(Lancamento).filter(Lancamento.categoria_id == categoria.id).count()
