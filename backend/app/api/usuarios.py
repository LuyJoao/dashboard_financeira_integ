from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import hash_senha
from ..db import get_db
from ..deps import exigir_admin
from ..models import Usuario
from ..schemas import UsuarioCreate, UsuarioOut, UsuarioUpdate

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


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def editar(
    usuario_id: int,
    dados: UsuarioUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
):
    """Edita nome, e-mail, perfil e/ou situação. Desativar = `ativo: false` (o histórico fica; o acesso cai na hora)."""
    user = db.get(Usuario, usuario_id)
    if not user:
        raise HTTPException(404, "Usuário não encontrado")
    mudancas = {k: v for k, v in dados.model_dump().items() if v is not None}
    if not mudancas:
        raise HTTPException(422, "Informe ao menos um campo para alterar")

    # Quem edita é sempre um administrador ativo; só ele mesmo pode ficar sem o acesso. Impedir isso
    # também garante que sempre exista ao menos um administrador ativo.
    if user.id == admin.id and (mudancas.get("role", user.role) != "admin" or mudancas.get("ativo", user.ativo) is False):
        raise HTTPException(409, "Você não pode remover o seu próprio acesso de administrador.")

    if "email" in mudancas:
        novo = mudancas["email"].lower()
        if novo != user.email and db.scalar(select(Usuario.id).where(Usuario.email == novo)):
            raise HTTPException(409, "E-mail já cadastrado")
        mudancas["email"] = novo

    for campo, valor in mudancas.items():
        setattr(user, campo, valor)
    db.commit()
    db.refresh(user)
    return user
