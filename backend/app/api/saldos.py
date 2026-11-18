from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..schemas import DadosSaldos
from ..services.saldos import montar_dados

router = APIRouter(
    prefix="/api/saldos",
    tags=["saldos"],
    dependencies=[Depends(usuario_atual)],
)


@router.get("", response_model=DadosSaldos)
def listar(db: Session = Depends(get_db)):
    return montar_dados(db)
