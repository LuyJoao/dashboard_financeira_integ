from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..schemas import DashboardOut
from ..services import dashboard as servico

# Contrato com o front: desktop/src/api/dashboard.ts
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(usuario_atual)])


@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    """Receitas, despesas, aplicações e resgates por mês; categorias; conciliação por conta e mês."""
    return servico.montar(db)
