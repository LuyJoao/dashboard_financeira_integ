from collections import defaultdict
from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Categoria, Conta, Empresa, Lancamento
from ..schemas import LancamentoEdicaoIn
from .planilha import ErroLinha, Linha, Resultado, competencia_da_data
from .signaturas import assinatura_importacao
from .validacoes import validar_lancamento


@dataclass
class Comparacao:
    linha: Linha
    situacao: Literal["nova", "igual", "atualizada"]
    existente: Lancamento | None
    mudancas: list[str]


def validar_referencias(db: Session, resultado: Resultado) -> None:
    contas = {conta.nome.casefold(): conta.nome for conta in db.scalars(select(Conta))}
    categorias = {categoria.nome.casefold(): categoria.nome for categoria in db.scalars(select(Categoria))}
    linhas_validas = []
    for linha in resultado.linhas:
        erros = []
        conta = contas.get(linha.banco.casefold())
        categoria = categorias.get(linha.categoria.casefold())
        if not conta:
            erros.append(("Banco", f'Conta "{linha.banco}" não existe no cadastro.'))
        if not categoria:
            erros.append(("Categoria", f'Categoria "{linha.categoria}" não existe no cadastro.'))
        if erros:
            resultado.erros.extend(
                ErroLinha(linha.linha, coluna, mensagem, linha.bruto)
                for coluna, mensagem in erros
            )
        else:
            linha.banco = conta
            linha.categoria = categoria
            linhas_validas.append(linha)
    resultado.linhas = linhas_validas


def classificar(db: Session, linhas: list[Linha]) -> list[Comparacao]:
    ocorrencias: dict[str, int] = defaultdict(int)
    for linha in linhas:
        linha.assinatura = assinatura_importacao(
            linha.banco, linha.data, linha.descricao, linha.valor_centavos, linha.documento
        )
        ocorrencias[linha.assinatura] += 1
        linha.ordem_repeticao = ocorrencias[linha.assinatura]

    assinaturas = {linha.assinatura for linha in linhas}
    existentes = db.scalars(
        select(Lancamento).where(Lancamento.assinatura.in_(assinaturas))
    ).all() if assinaturas else []
    por_chave = {(l.assinatura, l.ordem_repeticao): l for l in existentes}

    comparacoes = []
    for linha in linhas:
        existente = por_chave.get((linha.assinatura, linha.ordem_repeticao))
        if existente is None:
            comparacoes.append(Comparacao(linha, "nova", None, []))
            continue
        mudancas = []
        campos = (
            ("Data", existente.data, linha.data),
            ("Conta", existente.banco, linha.banco),
            ("Descrição", existente.descricao, linha.descricao),
            ("Valor", existente.valor_centavos, linha.valor_centavos),
            ("Documento", existente.documento or "", linha.documento or ""),
            ("Tipo", existente.tipo, linha.tipo),
            ("Categoria", existente.categoria, linha.categoria),
            ("Observação", existente.observacao or "", linha.observacao or ""),
            ("Código de operação", existente.cod_operacao or "", linha.cod_operacao or ""),
            ("Saldo após lançamento", existente.saldo_apos_centavos, linha.saldo_apos_centavos),
        )
        for nome, antes, depois in campos:
            if antes != depois:
                mudancas.append(nome)
        situacao = "atualizada" if mudancas else "igual"
        comparacoes.append(Comparacao(linha, situacao, existente, mudancas))
    return comparacoes


def linha_corrigida(db: Session, erro: ErroLinha, dados: LancamentoEdicaoIn) -> Linha:
    try:
        conta, categoria = validar_lancamento(db, dados)
    except HTTPException as exc:
        raise HTTPException(exc.status_code, f"Linha {erro.linha}: {exc.detail}") from None

    bruto = erro.bruto
    documento_bruto = bruto.get("documento")
    documento = None if documento_bruto in (None, "") else str(documento_bruto).strip()
    codigo_bruto = bruto.get("cod_operacao")
    cod_operacao = None if codigo_bruto in (None, "") else str(codigo_bruto).strip()
    saldo_bruto = bruto.get("saldo_apos_lancamento")
    saldo_apos = None
    if saldo_bruto not in (None, ""):
        try:
            from .planilha import _centavos

            saldo_apos = _centavos(saldo_bruto, estrito=False)
        except ValueError:
            saldo_apos = None
    competencia = competencia_da_data(dados.data)
    corrigida = Linha(
        linha=erro.linha,
        data=dados.data,
        competencia=competencia,
        banco=conta.nome,
        tipo=dados.tipo,
        categoria=categoria.nome,
        descricao=dados.descricao.strip(),
        observacao=dados.observacao.strip() or None,
        documento=documento,
        cod_operacao=cod_operacao,
        valor_centavos=dados.valor,
        saldo_apos_centavos=saldo_apos,
        ordem_extrato=erro.linha,
        bruto=bruto,
    )
    corrigida.assinatura = assinatura_importacao(
        corrigida.banco, corrigida.data, corrigida.descricao, corrigida.valor_centavos, corrigida.documento
    )
    return corrigida


def empresa_id_por_observacao(db: Session, observacao: str | None) -> int | None:
    if not observacao:
        return None
    prefixo = "empresa "
    if not observacao.casefold().startswith(prefixo):
        return None
    nome = observacao[len(prefixo):].strip()
    if not nome:
        return None
    empresa = db.scalar(select(Empresa).where(func.lower(Empresa.nome) == nome.lower()))
    return empresa.id if empresa else None


def aplicar_linha(lancamento: Lancamento, linha: Linha, conta: Conta, categoria: Categoria, empresa_id: int | None) -> None:
    lancamento.conta_id = conta.id
    lancamento.categoria_id = categoria.id
    lancamento.empresa_id = empresa_id
    lancamento.competencia = linha.competencia
    lancamento.data = linha.data
    lancamento.banco = linha.banco
    lancamento.tipo = linha.tipo
    lancamento.categoria = linha.categoria
    lancamento.descricao = linha.descricao
    lancamento.observacao = linha.observacao
    lancamento.documento = linha.documento
    lancamento.cod_operacao = linha.cod_operacao
    lancamento.valor_centavos = linha.valor_centavos
    lancamento.saldo_apos_centavos = linha.saldo_apos_centavos
    lancamento.origem = "importado"
    lancamento.assinatura = linha.assinatura
    lancamento.ordem_repeticao = linha.ordem_repeticao
    lancamento.ordem_extrato = linha.ordem_extrato
