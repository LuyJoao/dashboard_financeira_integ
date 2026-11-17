"""Dashboard: valores esperados calculados à mão a partir de tests/planilhas.py."""
from datetime import datetime

import pytest

from app.core.config import settings
from tests.planilhas import CAIXA, LINHAS_OK, SALDOS_OK, UNICRED, L, importar, xlsx


def dashboard(client, h):
    r = client.get("/api/dashboard", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def d(client, h_admin):
    importar(client, h_admin, xlsx())
    return dashboard(client, h_admin)


def test_sem_nenhuma_importacao_vem_vazio(client, h_admin):
    assert dashboard(client, h_admin) == {
        "instituicao": "INTEG", "atualizado_em": None, "contas": [], "meses": [], "categorias": [], "saldos": [],
    }


def test_instituicao_vem_da_configuracao(client, h_admin, monkeypatch):
    monkeypatch.setattr(settings, "instituicao", "Outra Instituição")
    assert dashboard(client, h_admin)["instituicao"] == "Outra Instituição"


def test_atualizado_em_e_a_data_da_ultima_importacao(client, h_admin):
    importar(client, h_admin, xlsx())
    primeiro = dashboard(client, h_admin)["atualizado_em"]
    importar(client, h_admin, xlsx())
    segundo = dashboard(client, h_admin)["atualizado_em"]
    assert primeiro and "T" in primeiro and segundo > primeiro


def test_contas_e_meses_em_ordem(d):
    assert d["contas"] == [CAIXA, UNICRED]
    assert [m["mes"] for m in d["meses"]] == ["Jan/26", "Fev/26"]


def test_receitas_despesas_aplicacoes_e_resgates_por_mes(d):
    jan, fev = d["meses"]
    # Jan: receitas 1500 + 1000,50 + 200 + rendimento 12,34 | despesas -300 | aplicação -5000 | resgate 1000
    assert jan == {"mes": "Jan/26", "receitas": 271284, "despesas": -30000, "aplicacoes": -500000, "resgates": 100000}
    # Fev: receitas 1500 | despesas -80,25 -8,50 -8,50 | sem aplicação | resgate 500
    assert fev == {"mes": "Fev/26", "receitas": 150000, "despesas": -9725, "aplicacoes": 0, "resgates": 50000}


def test_resgate_e_reconhecido_pela_observacao_e_pela_descricao(d):
    # Jan: observação "Resgate" (descrição "Aplicação Financeira"); Fev: descrição "Resgate Aplicação" (sem observação)
    assert d["meses"][0]["resgates"] == 100000 and d["meses"][1]["resgates"] == 50000


def test_aplicacao_e_resgate_ficam_fora_das_categorias_e_o_rendimento_vira_receita(d):
    c = {x["categoria"]: x for x in d["categorias"]}
    assert "Aplicação Financeira" not in c
    assert c["Rendimentos de Aplicações"] == {"categoria": "Rendimentos de Aplicações", "receitas": 1234, "despesas": 0}
    assert c["Taxa de Incubação"] == {"categoria": "Taxa de Incubação", "receitas": 400050, "despesas": 0}
    assert c["Despesas Administrativas"]["despesas"] == -38025 and c["Tarifas Bancárias"]["despesas"] == -1700
    assert [x["categoria"] for x in d["categorias"]] == sorted(c)  # em ordem alfabética


def test_receitas_e_despesas_das_categorias_fecham_com_as_dos_meses(d):
    assert sum(c["receitas"] for c in d["categorias"]) == sum(m["receitas"] for m in d["meses"])
    assert sum(c["despesas"] for c in d["categorias"]) == sum(m["despesas"] for m in d["meses"])


def test_conciliacao_bate_quando_os_saldos_informados_estao_certos(d):
    s = {(x["mes"], x["conta"]): x for x in d["saldos"]}
    assert len(s) == 4 and all(x["status"] == "OK" and x["diferenca"] == 0 for x in s.values())
    # Jan Unicred: inicial 10.000 + entradas 3.512,84 (1500+1000,50+12,34+1000) + saídas -5.300 (-300-5000) = 8.212,84
    assert s[("Jan/26", UNICRED)] == {
        "mes": "Jan/26", "conta": UNICRED, "saldo_inicial": 1000000, "entradas": 351284, "saidas": -530000,
        "saldo_final": 821284, "saldo_informado": 821284, "diferenca": 0, "status": "OK",
    }
    # a conciliação conta TUDO pelo sinal (inclusive aplicações e resgates), como a planilha
    assert (s[("Fev/26", UNICRED)]["entradas"], s[("Fev/26", UNICRED)]["saidas"], s[("Fev/26", UNICRED)]["saldo_final"]) == (200000, -1700, 1019584)
    assert (s[("Fev/26", CAIXA)]["saldo_final"], s[("Jan/26", CAIXA)]["saldo_final"]) == (11975, 20000)


def test_divergencia_quando_o_saldo_informado_nao_bate(client, h_admin):
    saldos = [dict(x) for x in SALDOS_OK]
    saldos[1]["Saldo Final Informado"] += 1.00  # Jan Unicred: informado R$ 1,00 acima do calculado
    importar(client, h_admin, xlsx(saldos=saldos))
    s = {(x["mes"], x["conta"]): x for x in dashboard(client, h_admin)["saldos"]}
    assert s[("Jan/26", UNICRED)]["status"] == "DIVERGÊNCIA" and s[("Jan/26", UNICRED)]["diferenca"] == -100
    assert s[("Fev/26", UNICRED)]["status"] == "OK"


def test_linha_recusada_na_importacao_aparece_como_divergencia(client, h_admin):
    # uma despesa de 30,00 com data fora do mês é recusada; o saldo informado já a considerava -> diferença de 30,00
    saldos = [dict(x) for x in SALDOS_OK]
    saldos[1]["Saldo Final Informado"] -= 30.00
    ruim = L("Jan/26", datetime(2026, 3, 9), UNICRED, "Despesa", "Fora do mês", "Outros", -30.0)
    importar(client, h_admin, xlsx(LINHAS_OK + [ruim], saldos=saldos))
    s = {(x["mes"], x["conta"]): x for x in dashboard(client, h_admin)["saldos"]}
    assert s[("Jan/26", UNICRED)]["status"] == "DIVERGÊNCIA" and s[("Jan/26", UNICRED)]["diferenca"] == 3000


def test_sem_aba_de_saldos_nao_ha_conciliacao_mas_o_resto_funciona(client, h_admin):
    importar(client, h_admin, xlsx(saldos=None))
    d = dashboard(client, h_admin)
    assert d["saldos"] == [] and len(d["meses"]) == 2 and d["contas"] == [CAIXA, UNICRED]


def test_mes_so_com_saldos_aparece_com_zeros(client, h_admin):
    saldos = SALDOS_OK + [{"Mês": "Mar/26", "Banco": CAIXA, "Saldo Inicial": 5.0, "Saldo Final Informado": 5.0}]
    importar(client, h_admin, xlsx(saldos=saldos))
    d = dashboard(client, h_admin)
    assert d["meses"][-1] == {"mes": "Mar/26", "receitas": 0, "despesas": 0, "aplicacoes": 0, "resgates": 0}
    assert d["saldos"][-1]["status"] == "OK"


def test_investimento_positivo_conta_como_resgate(client, h_admin):
    extra = L("Jan/26", datetime(2026, 1, 28), UNICRED, "Investimento", "Resgate parcial", "Aplicação Financeira", 300.0)
    importar(client, h_admin, xlsx(LINHAS_OK + [extra], saldos=None))
    assert dashboard(client, h_admin)["meses"][0]["resgates"] == 100000 + 30000


def test_receita_de_aplicacao_sem_a_palavra_resgate_e_rendimento(client, h_admin):
    extra = L("Jan/26", datetime(2026, 1, 28), UNICRED, "Receita", "Crédito CDB", "Aplicação Financeira", 7.0)
    importar(client, h_admin, xlsx(LINHAS_OK + [extra], saldos=None))
    d = dashboard(client, h_admin)
    assert d["meses"][0]["receitas"] == 271284 + 700 and d["meses"][0]["resgates"] == 100000
