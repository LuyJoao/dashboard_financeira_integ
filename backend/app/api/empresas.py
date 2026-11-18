from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import exigir_admin, usuario_atual
from ..models import Empresa, Lancamento, Usuario
from ..schemas import EmpresaCreate, EmpresaDetalheOut, EmpresaOut, LancamentoOut

router = APIRouter(prefix="/api/empresas", tags=["empresas"], dependencies=[Depends(usuario_atual)])


def _lancamento_out(l: Lancamento) -> LancamentoOut:
    return LancamentoOut(
        id=l.id,
        data=l.data,
        banco=l.banco,
        categoria=l.categoria,
        tipo=l.tipo,
        descricao=l.descricao,
        observacao=l.observacao or "",
        valor=l.valor_centavos,
    )


def _empresa_out(e: Empresa) -> EmpresaOut:
    return EmpresaOut(id=e.id, nome=e.nome, tipo=e.tipo, cnpj=e.cnpj)


@router.get("", response_model=list[EmpresaOut])
def listar(db: Session = Depends(get_db)):
    return [_empresa_out(e) for e in db.scalars(select(Empresa).order_by(Empresa.nome))]


@router.post("", response_model=EmpresaOut, status_code=201, dependencies=[Depends(exigir_admin)])
def criar(dados: EmpresaCreate, db: Session = Depends(get_db), _: Usuario = Depends(exigir_admin)):
    nome = dados.nome.strip()
    if db.scalar(select(Empresa.id).where(func.lower(Empresa.nome) == nome.casefold())):
        raise HTTPException(409, "Já existe uma empresa com esse nome.")
    empresa = Empresa(nome=nome, tipo=dados.tipo, cnpj=dados.cnpj.strip() if dados.cnpj else None)
    db.add(empresa)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Nome ou CNPJ já cadastrado.") from None
    db.refresh(empresa)
    return _empresa_out(empresa)


@router.get("/{empresa_id}", response_model=EmpresaDetalheOut)
def detalhe(empresa_id: int, db: Session = Depends(get_db)):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(404, "Empresa não encontrada.")
    qtd, total, ultimo = db.execute(
        select(
            func.count(Lancamento.id),
            func.coalesce(func.sum(Lancamento.valor_centavos), 0),
            func.max(Lancamento.data),
        ).where(Lancamento.empresa_id == empresa_id)
    ).one()
    lancamentos = db.scalars(
        select(Lancamento)
        .where(Lancamento.empresa_id == empresa_id)
        .order_by(Lancamento.data.desc(), Lancamento.id.desc())
        .limit(1000)
    ).all()
    return EmpresaDetalheOut(
        **_empresa_out(empresa).model_dump(),
        qtd_lancamentos=int(qtd),
        total_centavos=int(total),
        ultimo_lancamento=ultimo,
        lancamentos=[_lancamento_out(l) for l in lancamentos],
    )
