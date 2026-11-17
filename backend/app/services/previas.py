"""Guarda em memória as prévias aguardando confirmação (token -> linhas válidas).

Limitações assumidas (API de um único processo, ferramenta interna):
- se a API reiniciar, as prévias pendentes se perdem (o usuário só reenvia o arquivo);
- com vários workers do uvicorn, o token pode cair em outro processo. Se um dia isso
  acontecer, trocar este módulo por uma tabela no banco mantendo as mesmas funções.
"""
import secrets
import threading
import time
from dataclasses import dataclass

from .planilha import Linha, Saldo

TTL_SEGUNDOS = 30 * 60

_lock = threading.Lock()
_previas: dict[str, "PreviaGuardada"] = {}


@dataclass
class PreviaGuardada:
    usuario_id: int
    arquivo_nome: str
    total: int
    linhas_erro: int
    linhas: list[Linha]
    saldos: list[Saldo]
    saldos_erro: int
    expira_em: float


def _limpar_expiradas() -> None:
    agora = time.monotonic()
    for token in [t for t, p in _previas.items() if p.expira_em <= agora]:
        del _previas[token]


def guardar(
    usuario_id: int, arquivo_nome: str, total: int, linhas_erro: int, linhas: list[Linha],
    saldos: list[Saldo], saldos_erro: int,
) -> str:
    """Uma prévia por usuário: enviar outro arquivo descarta a anterior."""
    token = secrets.token_urlsafe(24)
    with _lock:
        _limpar_expiradas()
        for t in [t for t, p in _previas.items() if p.usuario_id == usuario_id]:
            del _previas[t]
        _previas[token] = PreviaGuardada(
            usuario_id, arquivo_nome, total, linhas_erro, linhas, saldos, saldos_erro, time.monotonic() + TTL_SEGUNDOS
        )
    return token


def obter(token: str, usuario_id: int) -> PreviaGuardada | None:
    """Consulta sem consumir. Só o usuário que enviou o arquivo enxerga a prévia."""
    with _lock:
        _limpar_expiradas()
        p = _previas.get(token)
        return p if p and p.usuario_id == usuario_id else None


def retirar(token: str, usuario_id: int) -> PreviaGuardada | None:
    """Consome o token (uso único): duas confirmações simultâneas não gravam duas vezes."""
    with _lock:
        _limpar_expiradas()
        p = _previas.get(token)
        if p and p.usuario_id == usuario_id:
            del _previas[token]
            return p
        return None
