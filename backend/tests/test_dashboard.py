from datetime import date

from tests.planilhas import linha

CAIXA = "104 - Caixa"
UNICRED = "136 - Unicred"
ITAÚ = "341 - Itaú"


def _criar_categoria(client, headers, nome):
    resposta = client.post("/api/categorias", json={"nome": nome}, headers=headers)
    assert resposta.status_code == 201, resposta.text


def _importar(client, headers, registros):
    from tests.planilhas import xlsx

    p = client.post(
        "/api/importacoes/previa",
        files={"arquivo": ("saldos.xlsx", xlsx(registros))},
        headers=headers,
    )
    assert p.status_code == 200, p.text
    c = client.post(
        "/api/importacoes/confirmar",
        json={"token": p.json()["token"], "correcoes": []},
        headers=headers,
    )
    assert c.status_code == 200, c.text


def test_saldos_derivados_do_extrato_e_lancamento_manual(client, h_admin):
    _criar_categoria(client, h_admin, "Receitas")
    registros = [
        linha(date(2026, 1, 3), CAIXA, "Despesa", "Compra", "Receitas", -10.0, saldo_apos=90.0),
        linha(date(2026, 1, 10), CAIXA, "Receita", "Venda", "Receitas", 50.0, saldo_apos=141.0),
        linha(date(2026, 1, 15), UNICRED, "Investimento", "Aplicação", "Aplicação Financeira", -100.0, "Investimento"),
        linha(date(2026, 1, 20), UNICRED, "Receita", "Resgate", "Aplicação Financeira", 20.0),
        linha(date(2026, 1, 25), UNICRED, "Receita", "Juros", "Aplicação Financeira", 5.0, "Rendimento"),
    ]
    _importar(client, h_admin, registros)
    resposta = client.post(
        "/api/lancamentos",
        json={
            "data": "2026-02-02",
            "banco": CAIXA,
            "categoria": "Receitas",
            "tipo": "Receita",
            "descricao": "Lançamento manual",
            "observacao": "",
            "valor": 1000,
        },
        headers=h_admin,
    )
    assert resposta.status_code == 201, resposta.text

    r = client.get("/api/saldos", headers=h_admin)
    assert r.status_code == 200, r.text
    d = r.json()
    saldos = {(s["mes"], s["conta"]): s for s in d["saldos"]}
    janeiro = saldos[("01-2026", CAIXA)]
    fevereiro = saldos[("02-2026", CAIXA)]
    assert (janeiro["saldo_inicial"], janeiro["saldo_final"], janeiro["saldo_informado"]) == (10000, 14000, 14100)
    assert (janeiro["diferenca"], janeiro["status"]) == (-100, "DIVERGÊNCIA")
    assert (fevereiro["saldo_inicial"], fevereiro["saldo_final"], fevereiro["status"]) == (14100, 15100, "NÃO CONFERIDO")
    assert all(saldos[("02-2026", conta)]["status"] == "NÃO CONFERIDO" for conta in (UNICRED, ITAÚ))
    assert d["aplicado"] == [
        {"mes": "01-2026", "saldo_inicial": 0, "saldo_final": 8000, "calculado": 8000},
        {"mes": "02-2026", "saldo_inicial": 8000, "saldo_final": 8000, "calculado": 8000},
    ]


def test_dashboard_agrega_e_classifica_aplicacao_pelo_sinal_e_observacao(client, h_admin):
    _criar_categoria(client, h_admin, "Receitas")
    registros = [
        linha(date(2026, 1, 3), UNICRED, "Investimento", "Aplicação", "Aplicação Financeira", -100.0, "Investimento"),
        linha(date(2026, 1, 4), UNICRED, "Receita", "Linha 320", "Aplicação Financeira", 20.0, "Resgate"),
        linha(date(2026, 1, 5), UNICRED, "Receita", "Juros", "Aplicação Financeira", 5.0, "Rendimento"),
        linha(date(2026, 1, 6), CAIXA, "Receita", "Venda", "Receitas", 10.0),
    ]
    _importar(client, h_admin, registros)

    resposta = client.get("/api/dashboard", headers=h_admin)
    assert resposta.status_code == 200, resposta.text
    dados = resposta.json()
    assert dados["meses"] == ["01-2026"]
    assert dados["contas"] == [CAIXA, UNICRED, ITAÚ]
    movimentos = {(l["descricao"] if "descricao" in l else l["categoria"], l["movimento"]) for l in dados["resumo"]}
    assert ("Aplicação Financeira", "aplicacao") in movimentos
    assert ("Aplicação Financeira", "resgate") in movimentos
    assert ("Aplicação Financeira", "rendimento") in movimentos
    assert all({"mes", "conta", "categoria", "movimento", "receitas", "despesas"} == set(row) for row in dados["resumo"])


def test_categorias_e_contas_seedadas_sao_listadas(client, h_admin):
    categorias = client.get("/api/categorias", headers=h_admin)
    contas = client.get("/api/contas", headers=h_admin)
    assert categorias.status_code == contas.status_code == 200
    assert any(c["nome"] == "Aplicação Financeira" and c["sistema"] for c in categorias.json())
    assert contas.json() == [CAIXA, UNICRED, ITAÚ]
