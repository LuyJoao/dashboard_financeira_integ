from datetime import date

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Lancamento
from tests.planilhas import linha, xlsx

CAIXA = "104 - Caixa"
CATEGORIA = "Taxa de Incubação"


def cadastrar_categoria(client, headers, nome):
    resposta = client.post("/api/categorias", json={"nome": nome}, headers=headers)
    assert resposta.status_code == 201, resposta.text


def previa(client, headers, linhas, colunas=None):
    return client.post(
        "/api/importacoes/previa",
        files={"arquivo": ("extrato.xlsx", xlsx(linhas, colunas))},
        headers=headers,
    )


def confirmar(client, headers, token, correcoes=None):
    return client.post(
        "/api/importacoes/confirmar",
        json={"token": token, "correcoes": correcoes or []},
        headers=headers,
    )


def contar_lancamentos():
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(Lancamento))


def test_previa_sem_gravar_e_aceita_colunas_fora_de_ordem(client, h_admin):
    cadastrar_categoria(client, h_admin, CATEGORIA)
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Venda", CATEGORIA, 25.0)
    colunas = ["Valor", "Observação", "Categoria", "Discriminação", "Data", "Tipo", "Banco", "Documento", "Saldo Após Lançamento", "Extra"]
    registro["Extra"] = "ignorar"
    resposta = previa(client, h_admin, [registro], colunas)

    assert resposta.status_code == 200, resposta.text
    dados = resposta.json()
    assert (dados["novas"], dados["atualizadas"], dados["iguais"], dados["linhas_erro"]) == (1, 0, 0, 0)
    assert dados["periodos"] == ["01-2026"]
    assert contar_lancamentos() == 0


def test_reimportacao_classifica_igual_e_nao_duplica(client, h_admin):
    cadastrar_categoria(client, h_admin, CATEGORIA)
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Venda", CATEGORIA, 25.0, documento="NF 01")

    primeira = previa(client, h_admin, [registro]).json()
    assert confirmar(client, h_admin, primeira["token"]).status_code == 200
    segunda = previa(client, h_admin, [registro]).json()

    assert (segunda["novas"], segunda["atualizadas"], segunda["iguais"]) == (0, 0, 1)
    assert confirmar(client, h_admin, segunda["token"]).status_code == 200
    assert contar_lancamentos() == 1


def test_reconciliacao_preserva_duplicatas_legitimas(client, h_admin):
    cadastrar_categoria(client, h_admin, CATEGORIA)
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Bolsa", CATEGORIA, 20.0)

    primeira = previa(client, h_admin, [registro, registro]).json()
    assert primeira["novas"] == 2
    assert confirmar(client, h_admin, primeira["token"]).status_code == 200
    segunda = previa(client, h_admin, [registro, registro]).json()

    assert (segunda["novas"], segunda["iguais"]) == (0, 2)
    assert contar_lancamentos() == 2


def test_importacao_atualiza_campo_editavel_sem_mudar_assinatura(client, h_admin):
    cadastrar_categoria(client, h_admin, CATEGORIA)
    cadastrar_categoria(client, h_admin, "Vendas Bazar")
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Venda", CATEGORIA, 25.0)

    primeira = previa(client, h_admin, [registro]).json()
    confirmar(client, h_admin, primeira["token"])
    with SessionLocal() as db:
        lancamento = db.scalar(select(Lancamento))
        assinatura = lancamento.assinatura

    registro["Categoria"] = "Vendas Bazar"
    segunda = previa(client, h_admin, [registro]).json()
    assert segunda["atualizadas"] == 1
    assert confirmar(client, h_admin, segunda["token"]).status_code == 200
    with SessionLocal() as db:
        lancamento = db.scalar(select(Lancamento))
        assert lancamento.categoria == "Vendas Bazar"
        assert lancamento.assinatura == assinatura


def test_edicao_manual_preserva_assinatura_e_reimportacao_reconcilia(client, h_admin):
    cadastrar_categoria(client, h_admin, CATEGORIA)
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Descrição original", CATEGORIA, 25.0)
    p = previa(client, h_admin, [registro]).json()
    confirmar(client, h_admin, p["token"])
    with SessionLocal() as db:
        lancamento = db.scalar(select(Lancamento))
        lancamento_id = lancamento.id
        assinatura = lancamento.assinatura

    resposta = client.patch(
        f"/api/lancamentos/{lancamento_id}",
        json={
            "data": "2026-01-05",
            "banco": CAIXA,
            "categoria": CATEGORIA,
            "tipo": "Receita",
            "descricao": "Descrição editada",
            "observacao": "",
            "valor": 2500,
        },
        headers=h_admin,
    )
    assert resposta.status_code == 200, resposta.text
    with SessionLocal() as db:
        assert db.get(Lancamento, lancamento_id).assinatura == assinatura

    p = previa(client, h_admin, [registro]).json()
    assert p["atualizadas"] == 1
    assert confirmar(client, h_admin, p["token"]).status_code == 200
    with SessionLocal() as db:
        lancamento = db.get(Lancamento, lancamento_id)
        assert lancamento.descricao == "Descrição original"
        assert lancamento.assinatura == assinatura


def test_lancamento_manual_no_mes_permanece_apos_reimportacao(client, h_admin):
    cadastrar_categoria(client, h_admin, CATEGORIA)
    dados = {
        "data": "2026-01-05",
        "banco": CAIXA,
        "categoria": CATEGORIA,
        "tipo": "Receita",
        "descricao": "Manual",
        "observacao": "",
        "valor": 1000,
    }
    resposta_manual = client.post("/api/lancamentos", json=dados, headers=h_admin)
    assert resposta_manual.status_code == 201, resposta_manual.text
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Planilha", CATEGORIA, 20.0)

    p = previa(client, h_admin, [registro]).json()
    assert confirmar(client, h_admin, p["token"]).status_code == 200
    p = previa(client, h_admin, [registro]).json()
    assert confirmar(client, h_admin, p["token"]).status_code == 200

    with SessionLocal() as db:
        linhas = db.scalars(select(Lancamento).order_by(Lancamento.id)).all()
        assert len(linhas) == 2
        assert any(l.origem == "manual" and l.assinatura is None for l in linhas)


def test_linha_excluida_reaparece_como_nova(client, h_admin):
    cadastrar_categoria(client, h_admin, CATEGORIA)
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Venda", CATEGORIA, 25.0)
    p = previa(client, h_admin, [registro]).json()
    confirmar(client, h_admin, p["token"])
    with SessionLocal() as db:
        lancamento_id = db.scalar(select(Lancamento.id))
    assert client.delete(f"/api/lancamentos/{lancamento_id}", headers=h_admin).status_code == 204

    p = previa(client, h_admin, [registro]).json()
    assert p["novas"] == 1
    assert confirmar(client, h_admin, p["token"]).status_code == 200
    assert contar_lancamentos() == 1


def test_erro_retorna_linha_bruta_e_confirmacao_aplica_correcao(client, h_admin):
    cadastrar_categoria(client, h_admin, "Vendas Bazar")
    registro = linha(date(2026, 1, 5), CAIXA, "Receita", "Venda", "Categoria inexistente", 25.0)
    p = previa(client, h_admin, [registro]).json()
    assert p["linhas_erro"] == 1
    assert p["erros"][0]["bruto"]["categoria"] == "Categoria inexistente"

    correcao = {
        "linha": 2,
        "dados": {
            "data": "2026-01-05",
            "banco": CAIXA,
            "categoria": "Vendas Bazar",
            "tipo": "Receita",
            "descricao": "Venda",
            "observacao": "",
            "valor": 2500,
        },
    }
    resposta = confirmar(client, h_admin, p["token"], [correcao])
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["linhas_novas"] == 1


def test_observacao_de_aplicacao_invalida_vira_erro_corrigivel(client, h_admin):
    registro = linha(
        date(2026, 1, 5),
        CAIXA,
        "Receita",
        "Resgate",
        "Aplicação Financeira",
        25.0,
    )
    p = previa(client, h_admin, [registro]).json()
    assert p["linhas_erro"] == 1
    assert "Observação" in p["erros"][0]["coluna"]

    correcao = {
        "linha": 2,
        "dados": {
            "data": "2026-01-05",
            "banco": CAIXA,
            "categoria": "Aplicação Financeira",
            "tipo": "Receita",
            "descricao": "Resgate",
            "observacao": "Resgate",
            "valor": 2500,
        },
    }
    resposta = confirmar(client, h_admin, p["token"], [correcao])
    assert resposta.status_code == 200, resposta.text


def test_validacao_422_devolve_detail_textual(client, h_admin):
    resposta = client.post("/api/importacoes/confirmar", json={}, headers=h_admin)
    assert resposta.status_code == 422
    assert isinstance(resposta.json()["detail"], str)
