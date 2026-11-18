from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Empresa, Titulo
from ..schemas import TituloIn, TituloOut
from ..services.validacoes import validar_titulo

router = APIRouter(prefix="/api/titulos", tags=["titulos"], dependencies=[Depends(usuario_atual)])
FUSO_BRASIL = ZoneInfo("America/Sao_Paulo")


def _saida(titulo: Titulo, empresa_nome: str) -> TituloOut:
    return TituloOut(
        id=titulo.id,
        tipo=titulo.tipo,
        empresa_id=titulo.empresa_id,
        empresa_nome=empresa_nome,
        forma=titulo.forma,
        numero=titulo.numero,
        descricao=titulo.descricao,
        valor=titulo.valor_centavos,
        vencimento=titulo.vencimento,
        pago_em=titulo.pago_em,
    )


def _hoje_brasil():
    return datetime.now(FUSO_BRASIL).date()


@router.get("", response_model=list[TituloOut])
def listar(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Titulo, Empresa.nome)
        .join(Empresa, Empresa.id == Titulo.empresa_id)
        .order_by(Titulo.vencimento, Titulo.id)
    ).all()
    return [_saida(titulo, nome) for titulo, nome in rows]


@router.post("", response_model=TituloOut, status_code=201)
def criar(dados: TituloIn, db: Session = Depends(get_db)):
    empresa = validar_titulo(db, dados, _hoje_brasil())
    titulo = Titulo(
        tipo=dados.tipo,
        empresa_id=empresa.id,
        forma=dados.forma,
        numero=dados.numero.strip(),
        descricao=dados.descricao.strip(),
        valor_centavos=dados.valor,
        vencimento=dados.vencimento,
        pago_em=dados.pago_em,
    )
    db.add(titulo)
    db.commit()
    db.refresh(titulo)
    return _saida(titulo, empresa.nome)


@router.patch("/{titulo_id}", response_model=TituloOut)
def editar(titulo_id: int, dados: TituloIn, db: Session = Depends(get_db)):
    titulo = db.get(Titulo, titulo_id)
    if not titulo:
        raise HTTPException(404, "Título não encontrado.")
    empresa = validar_titulo(db, dados, _hoje_brasil())
    titulo.tipo = dados.tipo
    titulo.empresa_id = empresa.id
    titulo.forma = dados.forma
    titulo.numero = dados.numero.strip()
    titulo.descricao = dados.descricao.strip()
    titulo.valor_centavos = dados.valor
    titulo.vencimento = dados.vencimento
    titulo.pago_em = dados.pago_em
    db.commit()
    db.refresh(titulo)
    return _saida(titulo, empresa.nome)


@router.delete("/{titulo_id}", status_code=204)
def excluir(titulo_id: int, db: Session = Depends(get_db)):
    titulo = db.get(Titulo, titulo_id)
    if not titulo:
        raise HTTPException(404, "Título não encontrado.")
    db.delete(titulo)
    db.commit()
    return Response(status_code=204)
