from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Conta, Lancamento
from ..schemas import AplicadoMes, DadosSaldos, DashboardSaldo
from .planilha import formatar_periodo

CATEGORIA_APLICACAO = "Aplicação Financeira"


def _meses_consecutivos(competencias: set[str]) -> list[str]:
    if not competencias:
        return []
    inicio = min(competencias)
    fim = max(competencias)
    ano, mes = map(int, inicio.split("-"))
    ano_fim, mes_fim = map(int, fim.split("-"))
    meses = []
    while (ano, mes) <= (ano_fim, mes_fim):
        if (ano, mes) >= (2026, 1):
            meses.append(f"{ano:04d}-{mes:02d}")
        mes += 1
        if mes == 13:
            ano += 1
            mes = 1
    return meses


def _carregar(db: Session):
    contas = db.scalars(select(Conta).order_by(Conta.id)).all()
    lancamentos = db.scalars(
        select(Lancamento)
        .where(Lancamento.competencia >= "2026-01")
        .order_by(
            Lancamento.competencia,
            Lancamento.data,
            Lancamento.ordem_extrato.asc().nulls_last(),
            Lancamento.id,
        )
    ).all()
    competencias = {l.competencia for l in lancamentos}
    return contas, lancamentos, _meses_consecutivos(competencias)


def montar_dados(db: Session) -> DadosSaldos:
    contas, lancamentos, competencias = _carregar(db)
    contas_nomes = [conta.nome for conta in contas]
    por_mes_conta: dict[tuple[str, str], list[Lancamento]] = defaultdict(list)
    aplicacoes: dict[str, int] = defaultdict(int)
    for lancamento in lancamentos:
        por_mes_conta[(lancamento.competencia, lancamento.banco)].append(lancamento)
        if (
            lancamento.categoria.casefold() == CATEGORIA_APLICACAO.casefold()
            and (lancamento.observacao or "").casefold() != "rendimento"
        ):
            aplicacoes[lancamento.competencia] += lancamento.valor_centavos

    saldos: list[DashboardSaldo] = []
    ultimo_saldo: dict[str, int] = {conta: 0 for conta in contas_nomes}
    saldo_aplicado = 0
    aplicado: list[AplicadoMes] = []

    for competencia in competencias:
        for conta in contas_nomes:
            linhas = por_mes_conta.get((competencia, conta), [])
            entradas = sum(l.valor_centavos for l in linhas if l.valor_centavos > 0)
            saidas = sum(l.valor_centavos for l in linhas if l.valor_centavos < 0)
            linhas_extrato = [l for l in linhas if l.origem == "importado"]
            primeira = linhas_extrato[0] if linhas_extrato else None
            ultima = linhas_extrato[-1] if linhas_extrato else None
            tem_inicial_extrato = primeira is not None and primeira.saldo_apos_centavos is not None
            tem_final_extrato = ultima is not None and ultima.saldo_apos_centavos is not None
            if tem_inicial_extrato:
                inicial = primeira.saldo_apos_centavos - primeira.valor_centavos
            else:
                inicial = ultimo_saldo[conta]

            calculado = inicial + entradas + saidas
            saldo_extrato = ultima.saldo_apos_centavos if tem_final_extrato else None
            lido = tem_final_extrato
            diferenca = calculado - saldo_extrato if lido else 0
            informado = saldo_extrato if lido else calculado
            status = "OK" if lido and diferenca == 0 else "DIVERGÊNCIA" if lido else "NÃO CONFERIDO"

            saldos.append(
                DashboardSaldo(
                    mes=formatar_periodo(competencia),
                    conta=conta,
                    saldo_inicial=inicial,
                    entradas=entradas,
                    saidas=saidas,
                    saldo_final=calculado,
                    saldo_informado=informado,
                    diferenca=diferenca,
                    status=status,
                )
            )
            ultimo_saldo[conta] = saldo_extrato if lido else calculado

        saldo_inicial_aplicado = saldo_aplicado
        saldo_aplicado = saldo_inicial_aplicado - aplicacoes.get(competencia, 0)
        aplicado.append(
            AplicadoMes(
                mes=formatar_periodo(competencia),
                saldo_inicial=saldo_inicial_aplicado,
                saldo_final=saldo_aplicado,
                calculado=saldo_aplicado,
            )
        )

    return DadosSaldos(
        contas=contas_nomes,
        meses=[formatar_periodo(c) for c in competencias],
        saldos=saldos,
        aplicado=aplicado,
    )


def extrair_saldos_previa(db: Session, comparacoes: list) -> tuple[list[dict], list[dict]]:
    """Calcula sugestões de extrato para a planilha e o aplicado acumulado após a reconciliação."""
    contas, existentes, meses_sistema = _carregar(db)
    nomes_contas = [conta.nome for conta in contas]
    linhas = [comparacao.linha for comparacao in comparacoes]
    meses_arquivo = sorted({linha.competencia for linha in linhas})
    por_mes_conta: dict[tuple[str, str], list] = defaultdict(list)
    for linha in linhas:
        por_mes_conta[(linha.competencia, linha.banco)].append(linha)

    saldos = []
    saldos_anteriores = {
        (saldo.mes, saldo.conta): saldo
        for saldo in montar_dados(db).saldos
    }
    carry = {conta: 0 for conta in nomes_contas}
    for competencia in sorted(set(meses_sistema) | set(meses_arquivo)):
        for conta in nomes_contas:
            rows = por_mes_conta.get((competencia, conta), [])
            if rows:
                rows.sort(key=lambda linha: (linha.data, linha.ordem_extrato))
                entradas = sum(l.valor_centavos for l in rows if l.valor_centavos > 0)
                saidas = sum(l.valor_centavos for l in rows if l.valor_centavos < 0)
                primeira, ultima = rows[0], rows[-1]
                inicial = (
                    primeira.saldo_apos_centavos - primeira.valor_centavos
                    if primeira.saldo_apos_centavos is not None
                    else None
                )
                final = ultima.saldo_apos_centavos
                lido = final is not None
                if inicial is None:
                    anterior = saldos_anteriores.get((formatar_periodo(competencia), conta))
                    inicial = anterior.saldo_inicial if anterior else carry[conta]
            else:
                anterior = saldos_anteriores.get((formatar_periodo(competencia), conta))
                inicial = anterior.saldo_inicial if anterior else carry[conta]
                entradas = 0
                saidas = 0
                final = anterior.saldo_informado if anterior and anterior.status != "NÃO CONFERIDO" else None
                lido = final is not None

            if final is not None:
                carry[conta] = final
            elif inicial is not None:
                carry[conta] = inicial + entradas + saidas
            if competencia in meses_arquivo:
                saldos.append(
                    {
                        "mes": formatar_periodo(competencia),
                        "conta": conta,
                        "entradas": entradas,
                        "saidas": saidas,
                        "saldo_inicial": inicial,
                        "saldo_final_informado": final,
                        "lido_do_extrato": bool(lido),
                    }
                )

    sums_by_month: dict[str, int] = defaultdict(int)
    for lancamento in existentes:
        if (
            lancamento.categoria.casefold() == CATEGORIA_APLICACAO.casefold()
            and (lancamento.observacao or "").casefold() != "rendimento"
        ):
            sums_by_month[lancamento.competencia] += lancamento.valor_centavos
    for comparacao in comparacoes:
        if comparacao.situacao == "igual":
            continue
        anterior = comparacao.existente
        if anterior and (
            anterior.categoria.casefold() == CATEGORIA_APLICACAO.casefold()
            and (anterior.observacao or "").casefold() != "rendimento"
        ):
            sums_by_month[anterior.competencia] -= anterior.valor_centavos
        linha = comparacao.linha
        if (
            linha.categoria.casefold() == CATEGORIA_APLICACAO.casefold()
            and (linha.observacao or "").casefold() != "rendimento"
        ):
            sums_by_month[linha.competencia] += linha.valor_centavos

    aplicado = []
    saldo = 0
    for competencia in sorted(set(meses_sistema) | set(meses_arquivo)):
        inicial = saldo
        saldo -= sums_by_month.get(competencia, 0)
        if competencia in meses_arquivo:
            aplicado.append(
                {
                    "mes": formatar_periodo(competencia),
                    "saldo_inicial": inicial,
                    "saldo_final": saldo,
                    "calculado": True,
                }
            )
    return saldos, aplicado
