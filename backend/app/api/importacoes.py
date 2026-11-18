from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Categoria, Conta, Importacao, Lancamento, Usuario
from ..schemas import ConfirmarIn, ImportacaoOut, LinhaAtualizada, LinhaPrevia, Previa
from ..schemas import ErroLinha as ErroLinhaOut
from ..services import previas
from ..services.planilha import PlanilhaInvalida, formatar_periodo, ler_planilha
from ..services.reconciliacao import (
    aplicar_linha,
    classificar,
    empresa_id_por_observacao,
    linha_corrigida,
    validar_referencias,
)
from ..services.saldos import extrair_saldos_previa

router = APIRouter(prefix="/api/importacoes", tags=["importacoes"])

TAMANHO_MAX = 10 * 1024 * 1024
AMOSTRA_MAX = 10
ERROS_MAX = 200


@router.post("/previa", response_model=Previa)
def previa(
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(usuario_atual),
):
    nome = arquivo.filename or "planilha.xlsx"
    if not nome.lower().endswith(".xlsx"):
        raise HTTPException(422, "Envie um arquivo .xlsx")
    conteudo = arquivo.file.read(TAMANHO_MAX + 1)
    if len(conteudo) > TAMANHO_MAX:
        raise HTTPException(413, "Arquivo maior que 10 MB")
    try:
        resultado = ler_planilha(conteudo)
    except PlanilhaInvalida as exc:
        raise HTTPException(422, str(exc)) from None
    if resultado.total == 0:
        raise HTTPException(422, 'A aba "Base" não tem linhas de dados.')

    validar_referencias(db, resultado)
    comparacoes = classificar(db, resultado.linhas)
    erros_por_linha = {erro.linha for erro in resultado.erros}
    periodos = sorted({linha.competencia for linha in resultado.linhas})
    saldos, aplicado = extrair_saldos_previa(db, comparacoes)
    token = previas.guardar(
        user.id,
        nome,
        resultado.total,
        resultado.linhas,
        resultado.erros,
    )
    categorias = list(db.scalars(select(Categoria.nome).order_by(Categoria.nome)))

    novas = sum(comparacao.situacao == "nova" for comparacao in comparacoes)
    atualizadas = sum(comparacao.situacao == "atualizada" for comparacao in comparacoes)
    iguais = sum(comparacao.situacao == "igual" for comparacao in comparacoes)
    linhas_amostra = [
        LinhaPrevia(
            linha=c.linha.linha,
            situacao=c.situacao,
            data=c.linha.data,
            banco=c.linha.banco,
            categoria=c.linha.categoria,
            tipo=c.linha.tipo,
            descricao=c.linha.descricao,
            valor=c.linha.valor_centavos,
        )
        for c in comparacoes
        if c.situacao != "igual"
    ][:AMOSTRA_MAX]
    return Previa(
        token=token,
        arquivo_nome=nome,
        total_linhas=resultado.total,
        novas=novas,
        atualizadas=atualizadas,
        iguais=iguais,
        linhas_erro=len(erros_por_linha),
        periodos=[formatar_periodo(mes) for mes in periodos],
        categorias=categorias,
        amostra=linhas_amostra,
        atualizadas_detalhe=[
            LinhaAtualizada(linha=c.linha.linha, descricao=c.linha.descricao, mudancas=c.mudancas)
            for c in comparacoes
            if c.situacao == "atualizada"
        ],
        erros=[
            ErroLinhaOut(
                linha=erro.linha,
                coluna=erro.coluna,
                mensagem=erro.mensagem,
                aba=erro.aba,
                bruto=erro.bruto,
            )
            for erro in resultado.erros[:ERROS_MAX]
        ],
        saldos=saldos,
        aplicado=aplicado,
    )


@router.post("/confirmar", response_model=ImportacaoOut)
def confirmar(
    dados: ConfirmarIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(usuario_atual),
):
    guardada = previas.obter(dados.token, user.id)
    if guardada is None:
        raise HTTPException(404, "Prévia expirada ou não encontrada. Envie o arquivo novamente.")

    erros_por_linha = {erro.linha: erro for erro in guardada.erros}
    correcoes_por_linha = {}
    for correcao in dados.correcoes:
        if correcao.linha not in erros_por_linha:
            raise HTTPException(422, f"A linha {correcao.linha} não possui erro corrigível nesta prévia.")
        if correcao.linha in correcoes_por_linha:
            raise HTTPException(422, f"A linha {correcao.linha} foi corrigida mais de uma vez.")
        correcoes_por_linha[correcao.linha] = correcao

    linhas = list(guardada.linhas)
    linhas.extend(
        linha_corrigida(db, erros_por_linha[numero], correcao.dados)
        for numero, correcao in correcoes_por_linha.items()
    )
    linhas.sort(key=lambda linha: linha.linha)
    comparacoes = classificar(db, linhas)
    quantidade_erros = len(erros_por_linha) - len(correcoes_por_linha)
    if not comparacoes and quantidade_erros == len(erros_por_linha):
        raise HTTPException(422, "Nenhuma linha válida para importar.")

    p = previas.retirar(dados.token, user.id)
    if p is None:
        raise HTTPException(404, "Prévia expirada ou não encontrada. Envie o arquivo novamente.")

    try:
        imp = Importacao(
            usuario_id=user.id,
            arquivo_nome=p.arquivo_nome,
            linhas_total=p.total,
            linhas_ok=len(comparacoes),
            linhas_novas=sum(c.situacao == "nova" for c in comparacoes),
            linhas_atualizadas=sum(c.situacao == "atualizada" for c in comparacoes),
            linhas_iguais=sum(c.situacao == "igual" for c in comparacoes),
            linhas_erro=quantidade_erros,
            status="concluida_com_erros" if quantidade_erros else "concluida",
        )
        db.add(imp)
        db.flush()
        contas = {conta.nome.casefold(): conta for conta in db.scalars(select(Conta))}
        categorias = {categoria.nome.casefold(): categoria for categoria in db.scalars(select(Categoria))}

        for comparacao in comparacoes:
            if comparacao.situacao == "igual":
                continue
            linha = comparacao.linha
            conta = contas[linha.banco.casefold()]
            categoria = categorias[linha.categoria.casefold()]
            lancamento = comparacao.existente or Lancamento()
            aplicar_linha(
                lancamento,
                linha,
                conta,
                categoria,
                empresa_id_por_observacao(db, linha.observacao),
            )
            lancamento.importacao_id = imp.id
            if comparacao.existente is None:
                db.add(lancamento)

        db.commit()
    except Exception:
        db.rollback()
        previas.restaurar(dados.token, p)
        raise

    db.refresh(imp)
    return _saida(imp, user.nome)


@router.get("", response_model=list[ImportacaoOut])
def listar(db: Session = Depends(get_db), _: Usuario = Depends(usuario_atual)):
    rows = db.execute(
        select(Importacao, Usuario.nome)
        .join(Usuario, Usuario.id == Importacao.usuario_id)
        .order_by(Importacao.enviado_em.desc(), Importacao.id.desc())
    ).all()
    return [_saida(imp, nome) for imp, nome in rows]


def _saida(imp: Importacao, usuario_nome: str) -> ImportacaoOut:
    return ImportacaoOut(
        id=imp.id,
        arquivo_nome=imp.arquivo_nome,
        enviado_em=imp.enviado_em,
        usuario_nome=usuario_nome,
        linhas_total=imp.linhas_total,
        linhas_novas=imp.linhas_novas,
        linhas_atualizadas=imp.linhas_atualizadas,
        linhas_iguais=imp.linhas_iguais,
        linhas_erro=imp.linhas_erro,
        status=imp.status,
    )
