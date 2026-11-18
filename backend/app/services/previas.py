"""Guarda temporariamente prévias de importação por usuário."""
import secrets
import threading
import time
from dataclasses import dataclass

from .planilha import ErroLinha, Linha

TTL_SEGUNDOS = 30 * 60

_lock = threading.Lock()
_previas: dict[str, "PreviaGuardada"] = {}


@dataclass
class PreviaGuardada:
    usuario_id: int
    arquivo_nome: str
    total: int
    linhas: list[Linha]
    erros: list[ErroLinha]
    expira_em: float


def _limpar_expiradas() -> None:
    agora = time.monotonic()
    for token in [token for token, previa in _previas.items() if previa.expira_em <= agora]:
        del _previas[token]


def guardar(
    usuario_id: int,
    arquivo_nome: str,
    total: int,
    linhas: list[Linha],
    erros: list[ErroLinha],
) -> str:
    token = secrets.token_urlsafe(24)
    with _lock:
        _limpar_expiradas()
        for anterior in [t for t, p in _previas.items() if p.usuario_id == usuario_id]:
            del _previas[anterior]
        _previas[token] = PreviaGuardada(
            usuario_id=usuario_id,
            arquivo_nome=arquivo_nome,
            total=total,
            linhas=linhas,
            erros=erros,
            expira_em=time.monotonic() + TTL_SEGUNDOS,
        )
    return token


def obter(token: str, usuario_id: int) -> PreviaGuardada | None:
    with _lock:
        _limpar_expiradas()
        previa = _previas.get(token)
        return previa if previa and previa.usuario_id == usuario_id else None


def retirar(token: str, usuario_id: int) -> PreviaGuardada | None:
    with _lock:
        _limpar_expiradas()
        previa = _previas.get(token)
        if previa and previa.usuario_id == usuario_id:
            del _previas[token]
            return previa
        return None


def restaurar(token: str, previa: PreviaGuardada) -> None:
    with _lock:
        _limpar_expiradas()
        if previa.expira_em > time.monotonic():
            _previas[token] = previa
