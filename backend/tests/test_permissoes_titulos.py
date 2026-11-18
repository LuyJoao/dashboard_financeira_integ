from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.api import titulos


def empresa(client, headers):
    resposta = client.post(
        "/api/empresas",
        json={"nome": "Fornecedor Alfa", "tipo": "fornecedor", "cnpj": None},
        headers=headers,
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def test_rotas_de_cadastro_exigem_admin(client, h_admin, h_user):
    categoria_admin = client.post("/api/categorias", json={"nome": "Nova"}, headers=h_admin)
    categoria_usuario = client.post("/api/categorias", json={"nome": "Outra"}, headers=h_user)
    empresa_usuario = client.post(
        "/api/empresas",
        json={"nome": "Empresa Usuário", "tipo": "incubada", "cnpj": None},
        headers=h_user,
    )
    assert categoria_admin.status_code == 201
    assert categoria_usuario.status_code == empresa_usuario.status_code == 403
    assert client.get("/api/categorias", headers=h_user).status_code == 200
    assert client.get("/api/empresas", headers=h_user).status_code == 200


def test_nome_de_empresa_e_categoria_nao_diferencia_maiusculas(client, h_admin):
    empresa(client, h_admin)
    categoria = client.post("/api/categorias", json={"nome": "Categoria Única"}, headers=h_admin)
    duplicada = client.post("/api/categorias", json={"nome": "CATEGORIA ÚNICA"}, headers=h_admin)
    empresa_duplicada = client.post(
        "/api/empresas",
        json={"nome": "FORNECEDOR ALFA", "tipo": "incubada", "cnpj": None},
        headers=h_admin,
    )
    assert categoria.status_code == 201
    assert duplicada.status_code == empresa_duplicada.status_code == 409


def test_usuario_comum_pode_criar_editar_e_excluir_titulo(client, h_admin, h_user, monkeypatch):
    cadastro = empresa(client, h_admin)
    monkeypatch.setattr(titulos, "_hoje_brasil", lambda: date(2026, 11, 18))
    titulo = {
        "tipo": "pagar",
        "empresa_id": cadastro["id"],
        "forma": "NF",
        "numero": "NF-01",
        "descricao": "Serviço",
        "valor": 12500,
        "vencimento": "2026-12-10",
        "pago_em": None,
    }
    criado = client.post("/api/titulos", json=titulo, headers=h_user)
    assert criado.status_code == 201, criado.text
    assert criado.json()["empresa_nome"] == "Fornecedor Alfa"
    titulo_id = criado.json()["id"]

    titulo["pago_em"] = "2026-11-18"
    editado = client.patch(f"/api/titulos/{titulo_id}", json=titulo, headers=h_user)
    assert editado.status_code == 200 and editado.json()["pago_em"] == "2026-11-18"
    titulo["pago_em"] = None
    desfeito = client.patch(f"/api/titulos/{titulo_id}", json=titulo, headers=h_user)
    assert desfeito.status_code == 200 and desfeito.json()["pago_em"] is None
    assert client.delete(f"/api/titulos/{titulo_id}", headers=h_user).status_code == 204


def test_pagamento_futuro_e_rejeitado_com_data_de_sao_paulo(client, h_admin, monkeypatch):
    cadastro = empresa(client, h_admin)
    monkeypatch.setattr(titulos, "_hoje_brasil", lambda: date(2026, 11, 18))
    payload = {
        "tipo": "receber",
        "empresa_id": cadastro["id"],
        "forma": "Boleto",
        "numero": "BL-01",
        "descricao": "",
        "valor": 1,
        "vencimento": "2026-11-18",
        "pago_em": "2026-11-19",
    }
    resposta = client.post("/api/titulos", json=payload, headers=h_admin)
    assert resposta.status_code == 422
    assert isinstance(resposta.json()["detail"], str)

    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    monkeypatch.undo()
    assert titulos._hoje_brasil() == hoje


def test_nao_e_possivel_remover_o_ultimo_admin_ativo(client, h_admin, admin):
    resposta = client.patch(
        f"/api/usuarios/{admin.id}",
        json={"ativo": False},
        headers=h_admin,
    )
    assert resposta.status_code == 409
    assert isinstance(resposta.json()["detail"], str)


def test_admin_pode_redefinir_senha_de_usuario(client, h_admin, usuario):
    resposta = client.post(
        f"/api/usuarios/{usuario.id}/redefinir-senha",
        json={"nova_senha": "SenhaNova123"},
        headers=h_admin,
    )
    assert resposta.status_code == 204
    login = client.post(
        "/api/auth/login",
        json={"email": usuario.email, "senha": "SenhaNova123"},
    )
    assert login.status_code == 200
