import pandas as pd
import pytest
from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Empresa, Importacao, Lancamento, SaldoMensal
from app.services import previas
from tests.helpers import criar_usuario, login_headers
from tests.planilhas import CAIXA, COLUNAS, L, LINHAS_INVALIDAS, LINHAS_OK, SALDOS_OK, UNICRED, importar, previa, xlsx


def contar(modelo) -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(modelo))


def confirmar(client, headers, token):
    return client.post("/api/importacoes/confirmar", json={"token": token}, headers=headers)


# ---------- prévia ----------
def test_previa_le_valida_e_nao_grava_nada(client, h_admin):
    r = previa(client, h_admin, xlsx())
    assert r.status_code == 200
    p = r.json()
    assert (p["total_linhas"], p["linhas_ok"], p["linhas_erro"]) == (12, 12, 0)
    assert p["periodos"] == ["Jan/26", "Fev/26"] and p["arquivo_nome"] == "planilha.xlsx"
    assert (p["saldos_ok"], p["saldos_erro"], p["linhas_substituidas"], p["erros"]) == (4, 0, 0, [])
    assert contar(Lancamento) == contar(SaldoMensal) == contar(Importacao) == contar(Empresa) == 0


def test_previa_devolve_amostra_no_formato_do_front(client, h_admin):
    p = previa(client, h_admin, xlsx()).json()
    assert len(p["amostra"]) == 10  # no máximo 10
    assert p["amostra"][0] == {
        "linha": 2, "data": "2026-01-05", "banco": UNICRED, "categoria": "Taxa de Incubação", "tipo": "Receita",
        "descricao": "Pix Recebido Alfa", "valor": 150000, "empresa": "Alfa",
    }


def test_previa_lista_os_erros_por_linha(client, h_admin):
    p = previa(client, h_admin, xlsx(LINHAS_OK + LINHAS_INVALIDAS)).json()
    assert (p["total_linhas"], p["linhas_ok"], p["linhas_erro"]) == (19, 12, 7)
    por_linha = {e["linha"]: (e["coluna"], e["mensagem"]) for e in p["erros"]}
    assert set(por_linha) == {14, 15, 16, 17, 18, 19, 20}
    assert por_linha[14][0] == "Data" and por_linha[15][0] == "Mês" and por_linha[18][0] == "Tipo" and por_linha[20][0] == "Categoria"
    assert por_linha[16] == ("Valor", "Receita deve ter valor positivo")
    assert all(e["aba"] == "Base" for e in p["erros"])


def test_previa_limita_a_lista_de_erros_mas_conta_todos(client, h_admin):
    ruins = [L("Jan/26", "ontem", CAIXA, "Despesa", "x", "Outros", -1.0)] * 250
    p = previa(client, h_admin, xlsx(ruins)).json()
    assert p["linhas_erro"] == 250 and len(p["erros"]) == 200


def test_previa_avisa_quantas_linhas_ja_gravadas_serao_substituidas(client, h_admin):
    importar(client, h_admin, xlsx())
    assert previa(client, h_admin, xlsx()).json()["linhas_substituidas"] == 12
    so_fevereiro = [l for l in LINHAS_OK if l["Mês"] == "Fev/26"]
    assert previa(client, h_admin, xlsx(so_fevereiro)).json()["linhas_substituidas"] == 5


# ---------- arquivo recusado ----------
@pytest.mark.parametrize(
    "nome,conteudo,status,trecho",
    [
        ("dados.csv", b"a,b", 422, ".xlsx"),
        ("dados.xlsx", b"nao e um xlsx", 422, "não é uma planilha"),
        ("dados.xlsx", xlsx(nome_aba="Outra"), 422, "Base"),
        ("dados.xlsx", xlsx([{c: None for c in COLUNAS[:-1]}], colunas_base=COLUNAS[:-1]), 422, "Valor"),
        ("dados.xlsx", xlsx([]), 422, "não tem linhas"),
        ("grande.xlsx", b"0" * (10 * 1024 * 1024 + 1), 413, "10 MB"),
    ],
)
def test_arquivos_invalidos(client, h_admin, nome, conteudo, status, trecho):
    r = previa(client, h_admin, conteudo, nome)
    assert r.status_code == status and trecho in r.json()["detail"]


# ---------- confirmar ----------
def test_confirmar_grava_lancamentos_empresas_saldos_e_historico(client, h_admin, admin):
    p = importar(client, h_admin, xlsx(), "extrato.xlsx")
    assert contar(Lancamento) == 12 and contar(SaldoMensal) == 4 and contar(Empresa) == 2
    with SessionLocal() as db:
        assert sorted(e.nome for e in db.scalars(select(Empresa))) == ["Alfa", "Beta Tech"]
        assert db.scalar(select(func.count()).select_from(Lancamento).where(Lancamento.empresa_id.is_not(None))) == 3
        imp = db.scalar(select(Importacao))
        assert (imp.usuario_id, imp.arquivo_nome, imp.linhas_total, imp.linhas_ok, imp.linhas_erro, imp.status) == (admin.id, "extrato.xlsx", 12, 12, 0, "concluida")
    assert p["token"]


def test_confirmar_guarda_valor_em_centavos_com_o_sinal_original(client, h_admin):
    importar(client, h_admin, xlsx())
    with SessionLocal() as db:
        valores = {l.descricao: l.valor_centavos for l in db.scalars(select(Lancamento)) if l.categoria != "Tarifas Bancárias"}
    assert valores["Internet do mês"] == -30000 and valores["Rendimento CDB"] == 1234 and valores["Aplicação CDB"] == -500000


def test_linhas_identicas_legitimas_sao_gravadas_as_duas(client, h_admin):
    importar(client, h_admin, xlsx())
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Lancamento).where(Lancamento.descricao == "Tarifa PIX")) == 2


def test_confirmar_com_erros_grava_so_as_linhas_validas_e_marca_o_status(client, h_admin):
    importar(client, h_admin, xlsx(LINHAS_OK + LINHAS_INVALIDAS))
    assert contar(Lancamento) == 12
    with SessionLocal() as db:
        imp = db.scalar(select(Importacao))
        assert (imp.linhas_total, imp.linhas_ok, imp.linhas_erro, imp.status) == (19, 12, 7, "concluida_com_erros")


def test_confirmar_responde_no_formato_do_historico(client, h_admin, admin):
    p = previa(client, h_admin, xlsx(), "extrato.xlsx").json()
    r = confirmar(client, h_admin, p["token"])
    assert r.status_code == 200
    assert set(r.json()) == {"id", "arquivo_nome", "enviado_em", "usuario_nome", "linhas_total", "linhas_ok", "linhas_erro", "status"}
    assert r.json()["usuario_nome"] == "Admin" and r.json()["status"] == "concluida"


def test_reimportar_o_mesmo_arquivo_nao_duplica(client, h_admin):
    importar(client, h_admin, xlsx())
    importar(client, h_admin, xlsx())
    assert contar(Lancamento) == 12 and contar(SaldoMensal) == 4 and contar(Empresa) == 2 and contar(Importacao) == 2


def test_substituicao_e_por_mes_os_outros_meses_ficam_intactos(client, h_admin):
    importar(client, h_admin, xlsx())
    so_janeiro = [L("Jan/26", pd.Timestamp("2026-01-31").to_pydatetime(), CAIXA, "Receita", "Correção de janeiro", "Vendas Bazar", 50.0)]
    importar(client, h_admin, xlsx(so_janeiro, saldos=None))
    with SessionLocal() as db:
        por_mes = dict(db.execute(select(Lancamento.competencia, func.count()).group_by(Lancamento.competencia)).all())
        assert por_mes == {"2026-01": 1, "2026-02": 5}  # janeiro foi trocado por 1 linha; fevereiro não mudou
    assert contar(SaldoMensal) == 4  # sem a aba de saldos, os saldos gravados ficam


def test_empresa_com_nome_escrito_diferente_reaproveita_a_mesma(client, h_admin):
    mais = [L("Fev/26", pd.Timestamp("2026-02-20").to_pydatetime(), UNICRED, "Receita", "Pix", "Taxa de Incubação", 10.0, obs="Empresa ALFA")]
    importar(client, h_admin, xlsx(LINHAS_OK + mais))
    assert contar(Empresa) == 2


def test_importar_so_os_saldos_tambem_e_valido(client, h_admin):
    so_invalidas = [LINHAS_INVALIDAS[0]]  # nenhuma linha válida na Base, mas há saldos válidos
    p = previa(client, h_admin, xlsx(so_invalidas)).json()
    assert p["linhas_ok"] == 0 and p["saldos_ok"] == 4
    assert confirmar(client, h_admin, p["token"]).status_code == 200
    assert contar(Lancamento) == 0 and contar(SaldoMensal) == 4


def test_sem_nenhuma_linha_valida_nao_ha_o_que_confirmar(client, h_admin):
    p = previa(client, h_admin, xlsx(LINHAS_INVALIDAS, saldos=None)).json()
    r = confirmar(client, h_admin, p["token"])
    assert r.status_code == 422 and "Nenhuma linha válida" in r.json()["detail"]
    assert contar(Importacao) == 0


# ---------- token ----------
def test_token_e_de_uso_unico(client, h_admin):
    token = previa(client, h_admin, xlsx()).json()["token"]
    assert confirmar(client, h_admin, token).status_code == 200
    r = confirmar(client, h_admin, token)
    assert r.status_code == 404 and "Prévia expirada" in r.json()["detail"]
    assert contar(Lancamento) == 12  # nada duplicado


def test_token_de_outro_usuario_ou_inventado_e_404(client, h_admin, h_user):
    token = previa(client, h_admin, xlsx()).json()["token"]
    assert confirmar(client, h_user, token).status_code == 404
    assert confirmar(client, h_admin, "token-inventado").status_code == 404
    assert contar(Lancamento) == 0
    assert confirmar(client, h_admin, token).status_code == 200  # e o dono ainda consegue usar o dele


def test_token_expirado_e_404(client, h_admin):
    token = previa(client, h_admin, xlsx()).json()["token"]
    previas._previas[token].expira_em = 0
    assert confirmar(client, h_admin, token).status_code == 404


def test_uma_previa_por_usuario_a_nova_descarta_a_anterior(client, h_admin):
    primeiro = previa(client, h_admin, xlsx()).json()["token"]
    segundo = previa(client, h_admin, xlsx()).json()["token"]
    assert confirmar(client, h_admin, primeiro).status_code == 404
    assert confirmar(client, h_admin, segundo).status_code == 200


def test_cada_usuario_tem_a_sua_previa(client, h_admin, h_user):
    a = previa(client, h_admin, xlsx()).json()["token"]
    b = previa(client, h_user, xlsx()).json()["token"]
    assert confirmar(client, h_admin, a).status_code == 200 and confirmar(client, h_user, b).status_code == 200


# ---------- histórico ----------
def test_historico_mais_recente_primeiro_com_quem_importou(client, h_admin, usuario, h_user):
    importar(client, h_admin, xlsx(), "primeira.xlsx")
    importar(client, h_user, xlsx(LINHAS_OK + LINHAS_INVALIDAS), "segunda.xlsx")
    r = client.get("/api/importacoes", headers=h_admin)
    assert r.status_code == 200
    h = r.json()
    assert [i["arquivo_nome"] for i in h] == ["segunda.xlsx", "primeira.xlsx"]
    assert [i["usuario_nome"] for i in h] == ["Ana", "Admin"]
    assert [(i["linhas_total"], i["linhas_ok"], i["linhas_erro"], i["status"]) for i in h] == [
        (19, 12, 7, "concluida_com_erros"), (12, 12, 0, "concluida"),
    ]


def test_historico_vazio(client, h_admin):
    assert client.get("/api/importacoes", headers=h_admin).json() == []


# ---------- aba Saldos_Mensais ----------
def test_previa_conta_os_saldos_e_identifica_a_aba_nos_erros(client, h_admin):
    saldos = SALDOS_OK[:3] + [{"Mês": "Janeiro", "Banco": CAIXA, "Saldo Inicial": 0.0, "Saldo Final Informado": 1.0}]
    p = previa(client, h_admin, xlsx(saldos=saldos)).json()
    assert (p["saldos_ok"], p["saldos_erro"], p["linhas_erro"]) == (3, 1, 0)
    (erro,) = p["erros"]
    assert erro["coluna"] == "Saldos_Mensais · Mês" and erro["aba"] == "Saldos_Mensais" and erro["linha"] == 5


def test_erro_so_nos_saldos_tambem_marca_a_importacao_com_erros(client, h_admin):
    saldos = SALDOS_OK[:3] + [{"Mês": "Janeiro", "Banco": CAIXA, "Saldo Inicial": 0.0, "Saldo Final Informado": 1.0}]
    p = importar(client, h_admin, xlsx(saldos=saldos))
    assert contar(SaldoMensal) == 3
    assert client.get("/api/importacoes", headers=h_admin).json()[0]["status"] == "concluida_com_erros"


def test_aba_de_saldos_sem_coluna_obrigatoria_e_422(client, h_admin):
    saldos = [{"Mês": "Jan/26", "Banco": CAIXA, "Saldo Final Informado": 1.0}]
    r = previa(client, h_admin, xlsx(saldos=saldos))
    assert r.status_code == 422 and "Saldo Inicial" in r.json()["detail"]


def test_saldos_tambem_sao_substituidos_por_mes(client, h_admin):
    importar(client, h_admin, xlsx())
    novo = [{"Mês": "Jan/26", "Banco": CAIXA, "Saldo Inicial": 1.0, "Saldo Final Informado": 2.0}]
    importar(client, h_admin, xlsx(saldos=novo))
    with SessionLocal() as db:
        jan = db.scalars(select(SaldoMensal).where(SaldoMensal.competencia == "2026-01")).all()
        assert [(s.banco, s.saldo_inicial_centavos) for s in jan] == [(CAIXA, 100)]  # janeiro trocado (só 1 conta agora)
        assert db.scalar(select(func.count()).select_from(SaldoMensal).where(SaldoMensal.competencia == "2026-02")) == 2
