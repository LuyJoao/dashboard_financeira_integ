from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import hash_senha
from ..db import get_db
from ..deps import exigir_admin
from ..models import Usuario
from ..schemas import UsuarioCreate, UsuarioOut

# Todas as rotas deste módulo exigem administrador (cadastro só pelo admin).
router = APIRouter(prefix="/api/usuarios", tags=["usuarios"], dependencies=[Depends(exigir_admin)])


@router.get("", response_model=list[UsuarioOut])
def listar(db: Session = Depends(get_db)):
    return db.scalars(select(Usuario).order_by(Usuario.nome)).all()


@router.post("", response_model=UsuarioOut, status_code=201)
def criar(dados: UsuarioCreate, db: Session = Depends(get_db)):
    email = dados.email.lower()
    if db.scalar(select(Usuario).where(Usuario.email == email)):
        raise HTTPException(409, "E-mail já cadastrado")
    user = Usuario(nome=dados.nome, email=email, senha_hash=hash_senha(dados.senha), role=dados.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
