from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import exigir_admin, usuario_atual
from ..models import Categoria, Lancamento
from ..schemas import CategoriaCreate, CategoriaOut
from ..services.validacoes import categoria_em_uso

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


def _saida(db: Session, categoria: Categoria) -> CategoriaOut:
    return CategoriaOut(
        id=categoria.id,
        nome=categoria.nome,
        sistema=categoria.sistema,
        em_uso=categoria_em_uso(db, categoria),
    )


@router.get("", response_model=list[CategoriaOut])
def listar(db: Session = Depends(get_db), _: object = Depends(usuario_atual)):
    categorias = db.scalars(select(Categoria).order_by(Categoria.nome)).all()
    return [_saida(db, categoria) for categoria in categorias]


@router.post("", response_model=CategoriaOut, status_code=201, dependencies=[Depends(exigir_admin)])
def criar(dados: CategoriaCreate, db: Session = Depends(get_db)):
    nome = dados.nome.strip()
    if db.scalar(select(Categoria.id).where(func.lower(Categoria.nome) == nome.lower())):
        raise HTTPException(409, "Já existe uma categoria com esse nome.")
    categoria = Categoria(nome=nome, sistema=False)
    db.add(categoria)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Já existe uma categoria com esse nome.") from None
    db.refresh(categoria)
    return _saida(db, categoria)


@router.patch("/{categoria_id}", response_model=CategoriaOut, dependencies=[Depends(exigir_admin)])
def editar(categoria_id: int, dados: CategoriaCreate, db: Session = Depends(get_db)):
    categoria = db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(404, "Categoria não encontrada.")
    if categoria.sistema:
        raise HTTPException(409, "A categoria do sistema não pode ser renomeada.")
    nome = dados.nome.strip()
    duplicada = db.scalar(
        select(Categoria.id).where(func.lower(Categoria.nome) == nome.lower(), Categoria.id != categoria.id)
    )
    if duplicada:
        raise HTTPException(409, "Já existe uma categoria com esse nome.")
    categoria.nome = nome
    db.query(Lancamento).filter(Lancamento.categoria_id == categoria.id).update(
        {Lancamento.categoria: nome}, synchronize_session=False
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Já existe uma categoria com esse nome.") from None
    db.refresh(categoria)
    return _saida(db, categoria)


@router.delete("/{categoria_id}", status_code=204, dependencies=[Depends(exigir_admin)])
def excluir(categoria_id: int, db: Session = Depends(get_db)):
    categoria = db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(404, "Categoria não encontrada.")
    if categoria.sistema:
        raise HTTPException(409, "A categoria do sistema não pode ser excluída.")
    em_uso = categoria_em_uso(db, categoria)
    if em_uso:
        raise HTTPException(409, f"Categoria em uso por {em_uso} lançamento(s). Não pode ser excluída.")
    db.delete(categoria)
    db.commit()
