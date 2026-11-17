"""Monta os dados do dashboard (contrato: desktop/src/api/dashboard.ts). Tudo em centavos, com o sinal original.

REGRA DE CLASSIFICAÇÃO (a confirmar com a supervisora; fica toda aqui para ser fácil de mudar):
- aplicação : tipo "Investimento" com valor negativo (dinheiro que saiu da conta para investir)
- resgate   : tipo "Investimento" com valor positivo, ou categoria "Aplicação Financeira" do tipo Receita
              cuja descrição/observação contém "resgat" (ex.: "Resgate", "Resgate Aplicação")
- rendimento: demais Receitas da categoria "Aplicação Financeira" -> entram em receitas, na categoria
              "Rendimentos de Aplicações"
Aplicações e resgates NÃO entram em receitas/despesas (vêm separados em `aplicacoes` e `resgates`).
O front tem um botão para incluí-los "como na planilha".
"""
from collections import defaultdict

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models import Importacao, Lancamento, SaldoMensal
from ..schemas import DashboardCategoria, DashboardMes, DashboardOut, DashboardSaldo
from .planilha import formatar_periodo

CATEGORIA_APLICACAO = "Aplicação Financeira"
CATEGORIA_RENDIMENTOS = "Rendimentos de Aplicações"

_resgate_no_texto = or_(Lancamento.descricao.ilike("%resgat%"), Lancamento.observacao.ilike("%resgat%"))

CLASSE = case(
    (Lancamento.tipo == "Investimento", case((Lancamento.valor_centavos < 0, "aplicacao"), else_="resgate")),
    (
        and_(Lancamento.categoria == CATEGORIA_APLICACAO, Lancamento.tipo == "Receita"),
        case((_resgate_no_texto, "resgate"), else_="rendimento"),
    ),
    else_="normal",
)
CATEGORIA_EXIBIDA = case((CLASSE == "rendimento", CATEGORIA_RENDIMENTOS), else_=Lancamento.categoria)
POSITIVO = Lancamento.valor_centavos > 0


def montar(db: Session) -> DashboardOut:
    # ---- receitas, despesas, aplicações e resgates por mês ----
    meses: dict[str, dict[str, int]] = defaultdict(lambda: {"receitas": 0, "despesas": 0, "aplicacoes": 0, "resgates": 0})
    for comp, classe, positivo, soma in db.execute(
        select(Lancamento.competencia, CLASSE, POSITIVO, func.sum(Lancamento.valor_centavos))
        .group_by(Lancamento.competencia, CLASSE, POSITIVO)
    ):
        m = meses[comp]
        if classe == "aplicacao":
            m["aplicacoes"] += int(soma)
        elif classe == "resgate":
            m["resgates"] += int(soma)
        else:  # normal ou rendimento
            m["receitas" if positivo else "despesas"] += int(soma)

    # ---- receitas x despesas por categoria (sem aplicações e resgates) ----
    categorias: dict[str, dict[str, int]] = defaultdict(lambda: {"receitas": 0, "despesas": 0})
    for cat, positivo, soma in db.execute(
        select(CATEGORIA_EXIBIDA, POSITIVO, func.sum(Lancamento.valor_centavos))
        .where(CLASSE.in_(("normal", "rendimento")))
        .group_by(CATEGORIA_EXIBIDA, POSITIVO)
    ):
        categorias[cat]["receitas" if positivo else "despesas"] += int(soma)

    # ---- conciliação: entradas e saídas por mês/conta (como a planilha: tudo, pelo sinal do valor) ----
    mov: dict[tuple[str, str], dict[str, int]] = defaultdict(lambda: {"entradas": 0, "saidas": 0})
    for comp, banco, positivo, soma in db.execute(
        select(Lancamento.competencia, Lancamento.banco, POSITIVO, func.sum(Lancamento.valor_centavos))
        .group_by(Lancamento.competencia, Lancamento.banco, POSITIVO)
    ):
        mov[(comp, banco)]["entradas" if positivo else "saidas"] += int(soma)

    saldos: list[DashboardSaldo] = []
    saldos_db = db.scalars(select(SaldoMensal).order_by(SaldoMensal.competencia, SaldoMensal.banco)).all()
    for s in saldos_db:
        m = mov[(s.competencia, s.banco)]
        final = s.saldo_inicial_centavos + m["entradas"] + m["saidas"]
        dif = final - s.saldo_informado_centavos
        saldos.append(DashboardSaldo(
            mes=formatar_periodo(s.competencia), conta=s.banco, saldo_inicial=s.saldo_inicial_centavos,
            entradas=m["entradas"], saidas=m["saidas"], saldo_final=final,
            saldo_informado=s.saldo_informado_centavos, diferenca=dif, status="OK" if dif == 0 else "DIVERGÊNCIA",
        ))

    todos_os_meses = sorted(set(meses) | {s.competencia for s in saldos_db})
    contas = sorted({b for (_, b) in mov} | {s.banco for s in saldos_db})
    return DashboardOut(
        instituicao=settings.instituicao,
        atualizado_em=db.scalar(select(func.max(Importacao.enviado_em))),
        contas=contas,
        meses=[
            DashboardMes(mes=formatar_periodo(c), **meses.get(c, {"receitas": 0, "despesas": 0, "aplicacoes": 0, "resgates": 0}))
            for c in todos_os_meses
        ],
        categorias=[DashboardCategoria(categoria=c, **v) for c, v in sorted(categorias.items())],
        saldos=saldos,
    )
