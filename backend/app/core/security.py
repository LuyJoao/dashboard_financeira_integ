import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher

from .config import settings

_ph = PasswordHasher()
ALG = "HS256"


def hash_senha(senha: str) -> str:
    return _ph.hash(senha)


def verificar_senha(senha: str, hash_: str) -> bool:
    try:
        return _ph.verify(hash_, senha)
    except Exception:
        return False


def criar_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    return jwt.encode({"sub": str(user_id), "exp": exp}, settings.secret_key, algorithm=ALG)


def ler_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[ALG])


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def novo_token_reset() -> tuple[str, str]:
    """Retorna (código enviado ao usuário, hash guardado no banco)."""
    raw = secrets.token_urlsafe(24)
    return raw, hash_token(raw)
