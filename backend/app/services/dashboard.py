from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models import Categoria, Importacao, Lancamento
from ..schemas import DashboardOut, LinhaResumo
from .planilha import formatar_periodo
from .saldos import CATEGORIA_APLICACAO, montar_dados


def _movimento(lancamento: Lancamento) -> str | None:
    if lancamento.categoria.casefold() != CATEGORIA_APLICACAO.casefold():
        return None
    if lancamento.valor_centavos < 0:
        return "aplicacao"
    if (lancamento.observacao or "").casefold() == "rendimento":
        return "rendimento"
    return "resgate"


def montar(db: Session) -> DashboardOut:
    lancamentos = db.scalars(
        select(Lancamento).where(Lancamento.competencia >= "2026-01").order_by(Lancamento.id)
    ).all()
    agregados: dict[tuple[str, str, str, str | None], dict[str, int]] = defaultdict(
        lambda: {"receitas": 0, "despesas": 0}
    )
    for lancamento in lancamentos:
        movimento = _movimento(lancamento)
        chave = (
            lancamento.competencia,
            lancamento.banco,
            lancamento.categoria,
            movimento,
        )
        agregados[chave]["receitas" if lancamento.valor_centavos > 0 else "despesas"] += lancamento.valor_centavos

    dados_saldos = montar_dados(db)
    meses = dados_saldos.meses
    categorias = list(db.scalars(select(Categoria.nome).order_by(Categoria.nome)))
    resumo = [
        LinhaResumo(
            mes=formatar_periodo(competencia),
            conta=conta,
            categoria=categoria,
            movimento=movimento,
            receitas=valores["receitas"],
            despesas=valores["despesas"],
        )
        for (competencia, conta, categoria, movimento), valores in sorted(
            agregados.items(), key=lambda item: item[0]
        )
    ]

    return DashboardOut(
        instituicao=settings.instituicao,
        atualizado_em=db.scalar(select(func.max(Importacao.enviado_em))),
        contas=dados_saldos.contas,
        categorias=categorias,
        meses=meses,
        resumo=resumo,
        saldos=dados_saldos.saldos,
        aplicado=[
            {"mes": item.mes, "saldo_inicial": item.saldo_inicial, "saldo_final": item.saldo_final}
            for item in dados_saldos.aplicado
        ],
    )
