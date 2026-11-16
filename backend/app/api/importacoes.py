import unicodedata

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Empresa, Importacao, Lancamento, SaldoMensal, Usuario
from ..schemas import ConfirmarIn, ErroLinha, ImportacaoOut, LinhaPrevia, Previa
from ..services import previas
from ..services.planilha import ABA_SALDOS, PlanilhaInvalida, formatar_periodo, ler_planilha

# Contrato com o front: desktop/src/api/importacoes.ts
router = APIRouter(prefix="/api/importacoes", tags=["importacoes"])

TAMANHO_MAX = 10 * 1024 * 1024  # 10 MB
AMOSTRA_MAX = 10
ERROS_MAX = 200  # o total real vai em linhas_erro; a lista é limitada para não estourar a resposta


def _chave(nome: str) -> str:
    """Normaliza o nome da empresa para comparar (sem acento, caixa ou espaços extras)."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", nome) if not unicodedata.combining(c))
    return " ".join(sem_acento.casefold().split())


@router.post("/previa", response_model=Previa)
def previa(
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Usuario = Depends(usuario_atual),
):
    """Lê e valida a planilha. NÃO grava nada; devolve um token para confirmar depois."""
    nome = arquivo.filename or "planilha.xlsx"
    if not nome.lower().endswith(".xlsx"):
        raise HTTPException(422, "Envie um arquivo .xlsx")
    conteudo = arquivo.file.read(TAMANHO_MAX + 1)
    if len(conteudo) > TAMANHO_MAX:
        raise HTTPException(413, "Arquivo maior que 10 MB")
    try:
        res = ler_planilha(conteudo)
    except PlanilhaInvalida as e:
        raise HTTPException(422, str(e)) from None
    if res.total == 0:
        raise HTTPException(422, 'A aba "Base" não tem linhas de dados.')

    competencias = sorted({l.competencia for l in res.linhas})
    substituidas = 0
    if competencias:
        substituidas = db.scalar(
            select(func.count()).select_from(Lancamento).where(Lancamento.competencia.in_(competencias))
        ) or 0

    token = previas.guardar(user.id, nome, res.total, res.linhas_com_erro, res.linhas, res.saldos, res.saldos_com_erro)
    return Previa(
        token=token,
        arquivo_nome=nome,
        total_linhas=res.total,
        linhas_ok=len(res.linhas),
        linhas_erro=res.linhas_com_erro,
        saldos_ok=len(res.saldos),
        saldos_erro=res.saldos_com_erro,
        linhas_substituidas=substituidas,
        periodos=[formatar_periodo(c) for c in competencias],
        amostra=[
            LinhaPrevia(
                linha=l.linha, data=l.data, banco=l.banco, categoria=l.categoria, tipo=l.tipo,
                descricao=l.descricao, valor=l.valor_centavos, empresa=l.empresa,
            )
            for l in res.linhas[:AMOSTRA_MAX]
        ],
        erros=_erros_para_resposta(res.erros, res.erros_saldos),
    )


def _erros_para_resposta(base, saldos) -> list[ErroLinha]:
    """Erros da Base (por linha) seguidos dos da aba Saldos_Mensais, que levam a aba no nome da coluna."""
    todos = [ErroLinha(linha=e.linha, coluna=e.coluna, mensagem=e.mensagem) for e in sorted(base, key=lambda e: e.linha)]
    todos += [
        ErroLinha(linha=e.linha, coluna=f"{ABA_SALDOS} · {e.coluna}", mensagem=e.mensagem, aba=e.aba)
        for e in sorted(saldos, key=lambda e: e.linha)
    ]
    return todos[:ERROS_MAX]


@router.post("/confirmar", response_model=ImportacaoOut)
def confirmar(dados: ConfirmarIn, db: Session = Depends(get_db), user: Usuario = Depends(usuario_atual)):
    """Grava as linhas válidas da prévia. Substitui os lançamentos dos meses presentes no arquivo."""
    p = previas.obter(dados.token, user.id)
    if p is None:
        raise HTTPException(404, "Prévia expirada ou não encontrada. Envie o arquivo novamente.")
    if not p.linhas and not p.saldos:
        raise HTTPException(422, "Nenhuma linha válida para importar.")
    p = previas.retirar(dados.token, user.id)  # uso único
    if p is None:
        raise HTTPException(404, "Prévia expirada ou não encontrada. Envie o arquivo novamente.")

    try:
        # empresas citadas nas Observações ("Empresa X"): reaproveita as existentes, cria as novas
        existentes = {_chave(e.nome): e for e in db.scalars(select(Empresa))}
        for nome in sorted({l.empresa for l in p.linhas if l.empresa}):  # ordem fixa = ids previsíveis
            if _chave(nome) not in existentes:
                emp = Empresa(nome=nome)
                db.add(emp)
                db.flush()
                existentes[_chave(nome)] = emp

        imp = Importacao(
            usuario_id=user.id,
            arquivo_nome=p.arquivo_nome,
            linhas_total=p.total,
            linhas_ok=len(p.linhas),
            linhas_erro=p.linhas_erro,
            status="concluida_com_erros" if (p.linhas_erro or p.saldos_erro) else "concluida",
        )
        db.add(imp)
        db.flush()

        competencias = sorted({l.competencia for l in p.linhas})
        if competencias:
            db.execute(delete(Lancamento).where(Lancamento.competencia.in_(competencias)))
        if p.linhas:
            db.execute(
                insert(Lancamento),
                [
                    {
                        "importacao_id": imp.id,
                        "empresa_id": existentes[_chave(l.empresa)].id if l.empresa else None,
                        "competencia": l.competencia,
                        "data": l.data,
                        "banco": l.banco,
                        "tipo": l.tipo,
                        "categoria": l.categoria,
                        "descricao": l.descricao,
                        "observacao": l.observacao,
                        "documento": l.documento,
                        "cod_operacao": l.cod_operacao,
                        "valor_centavos": l.valor_centavos,
                        "saldo_apos_centavos": l.saldo_apos_centavos,
                    }
                    for l in p.linhas
                ],
            )

        # saldos mensais (aba opcional): também substitui por mês
        meses_saldos = sorted({x.competencia for x in p.saldos})
        if meses_saldos:
            db.execute(delete(SaldoMensal).where(SaldoMensal.competencia.in_(meses_saldos)))
            db.execute(
                insert(SaldoMensal),
                [
                    {
                        "importacao_id": imp.id,
                        "competencia": x.competencia,
                        "banco": x.banco,
                        "saldo_inicial_centavos": x.saldo_inicial_centavos,
                        "saldo_informado_centavos": x.saldo_informado_centavos,
                    }
                    for x in p.saldos
                ],
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(imp)
    return _saida(imp, user.nome)


@router.get("", response_model=list[ImportacaoOut])
def listar(db: Session = Depends(get_db), _: Usuario = Depends(usuario_atual)):
    """Histórico: quem importou, quando e quantas linhas deram erro (mais recentes primeiro)."""
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
        linhas_ok=imp.linhas_ok,
        linhas_erro=imp.linhas_erro,
        status=imp.status,
    )
