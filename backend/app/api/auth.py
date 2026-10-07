from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core import security as sec
from ..core.config import settings
from ..db import get_db
from ..deps import usuario_atual
from ..models import ResetSenha, Usuario
from ..schemas import EsqueciSenhaIn, LoginIn, RedefinirSenhaIn, TokenOut, UsuarioOut
from ..services.email import enviar_reset

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(dados: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(Usuario).where(Usuario.email == dados.email.lower()))
    if not user or not user.ativo or not sec.verificar_senha(dados.senha, user.senha_hash):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return TokenOut(access_token=sec.criar_token(user.id))


@router.get("/me", response_model=UsuarioOut)
def me(user: Usuario = Depends(usuario_atual)):
    return user


@router.post("/esqueci-senha")
def esqueci_senha(dados: EsqueciSenhaIn, db: Session = Depends(get_db)):
    user = db.scalar(select(Usuario).where(Usuario.email == dados.email.lower()))
    if user and user.ativo:
        codigo, hash_ = sec.novo_token_reset()
        expira = datetime.now(timezone.utc) + timedelta(minutes=settings.reset_token_minutes)
        db.add(ResetSenha(usuario_id=user.id, token_hash=hash_, expira_em=expira))
        db.commit()
        enviar_reset(user.email, codigo)
    # resposta igual exista o e-mail ou não (não revela quais contas existem)
    return {"mensagem": "Se o e-mail estiver cadastrado, você receberá um código."}


@router.post("/redefinir-senha")
def redefinir_senha(dados: RedefinirSenhaIn, db: Session = Depends(get_db)):
    reg = db.scalar(select(ResetSenha).where(ResetSenha.token_hash == sec.hash_token(dados.codigo)))
    agora = datetime.now(timezone.utc)
    if not reg or reg.usado_em or reg.expira_em < agora:
        raise HTTPException(400, "Código inválido ou expirado")
    user = db.get(Usuario, reg.usuario_id)
    user.senha_hash = sec.hash_senha(dados.nova_senha)
    reg.usado_em = agora
    db.commit()
    return {"mensagem": "Senha atualizada. Entre com a nova senha."}
