from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Conta

router = APIRouter(prefix="/api/contas", tags=["contas"], dependencies=[Depends(usuario_atual)])


@router.get("", response_model=list[str])
def listar(db: Session = Depends(get_db)):
    return list(db.scalars(select(Conta.nome).order_by(Conta.id)))
