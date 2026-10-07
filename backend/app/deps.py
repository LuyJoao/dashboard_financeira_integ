import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .core.security import ler_token
from .db import get_db
from .models import Usuario

bearer = HTTPBearer(auto_error=False)


def usuario_atual(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    erro = HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    if not cred:
        raise erro
    try:
        uid = int(ler_token(cred.credentials)["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise erro
    user = db.get(Usuario, uid)
    if not user or not user.ativo:
        raise erro
    return user


def exigir_admin(user: Usuario = Depends(usuario_atual)) -> Usuario:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Apenas administradores")
    return user
