"""Planilhas SINTÉTICAS para os testes (nenhum dado financeiro real no repositório).

Mesmo formato da planilha da INTEG: aba "Base" e aba opcional "Saldos_Mensais". Os números esperados nos testes
foram calculados à mão a partir destas linhas.
"""
import io
from datetime import datetime

import pandas as pd

COLUNAS = ["Mês", "Data", "Banco", "Tipo", "Cód. Op. Ban.", "Documento", "Discriminação (original)", "Categoria", "Observação", "Valor"]
CAIXA, UNICRED = "104 - Caixa", "136 - Unicred"


def L(mes, data, banco, tipo, desc, cat, valor, obs=None, doc=None, cod=None) -> dict:
    return dict(zip(COLUNAS, [mes, data, banco, tipo, cod, doc, desc, cat, obs, valor]))


D = datetime
LINHAS_OK = [
    L("Jan/26", D(2026, 1, 5), UNICRED, "Receita", "Pix Recebido Alfa", "Taxa de Incubação", 1500.00, obs="Empresa Alfa", doc="Recibo 01/26", cod=1001),
    L("Jan/26", D(2026, 1, 6), UNICRED, "Receita", "Pix Recebido Beta", "Taxa de Incubação", 1000.50, obs="Empresa Beta Tech"),
    L("Jan/26", D(2026, 1, 10), UNICRED, "Despesa", "Internet do mês", "Despesas Administrativas", -300.00),
    L("Jan/26", D(2026, 1, 12), CAIXA, "Receita", "Venda bazar", "Vendas Bazar", 200.00),
    L("Jan/26", D(2026, 1, 15), UNICRED, "Investimento", "Aplicação CDB", "Aplicação Financeira", -5000.00, obs="Investimento"),
    L("Jan/26", D(2026, 1, 20), UNICRED, "Receita", "Rendimento CDB", "Aplicação Financeira", 12.34, obs="Rendimento"),
    L("Jan/26", D(2026, 1, 25), UNICRED, "Receita", "Aplicação Financeira", "Aplicação Financeira", 1000.00, obs="Resgate"),
    L("Fev/26", D(2026, 2, 3), UNICRED, "Receita", "Pix Recebido Alfa", "Taxa de Incubação", 1500.00, obs="Empresa Alfa"),
    L("Fev/26", D(2026, 2, 8), CAIXA, "Despesa", "Material de limpeza", "Despesas Administrativas", -80.25),
    L("Fev/26", D(2026, 2, 10), UNICRED, "Receita", "Resgate Aplicação", "Aplicação Financeira", 500.00),
    # duas linhas idênticas: legítimas (a planilha real tem várias), as duas precisam ser gravadas
    L("Fev/26", D(2026, 2, 15), UNICRED, "Despesa", "Tarifa PIX", "Tarifas Bancárias", -8.50),
    L("Fev/26", D(2026, 2, 15), UNICRED, "Despesa", "Tarifa PIX", "Tarifas Bancárias", -8.50),
]

# Mês, Banco, Saldo Inicial, Saldo Final Informado (já batendo com as linhas acima)
SALDOS_OK = [
    {"Mês": "Jan/26", "Banco": CAIXA, "Saldo Inicial": 0.00, "Saldo Final Informado": 200.00},
    {"Mês": "Jan/26", "Banco": UNICRED, "Saldo Inicial": 10000.00, "Saldo Final Informado": 8212.84},
    {"Mês": "Fev/26", "Banco": CAIXA, "Saldo Inicial": 200.00, "Saldo Final Informado": 119.75},
    {"Mês": "Fev/26", "Banco": UNICRED, "Saldo Inicial": 8212.84, "Saldo Final Informado": 10195.84},
]

# 7 linhas inválidas (linhas 14 a 20 da planilha, pois LINHAS_OK ocupa as linhas 2 a 13)
LINHAS_INVALIDAS = [
    L("Mai/26", "14//05/26", CAIXA, "Despesa", "Data ruim", "Outros", -10.0),  # 14: data em texto inválido
    L("Abr/26", D(2026, 3, 3), UNICRED, "Despesa", "Mês errado", "Outros", -20.0),  # 15: mês não bate com a data
    L("Jan/26", D(2026, 1, 9), UNICRED, "Receita", "Sinal errado", "Outros", -30.0),  # 16: receita negativa
    L("Jan/26", D(2026, 1, 9), UNICRED, "Despesa", "Sinal errado 2", "Outros", 40.0),  # 17: despesa positiva
    L("Jan/26", D(2026, 1, 9), UNICRED, "Outro", "Tipo ruim", "Outros", -50.0),  # 18: tipo desconhecido
    L("Jan/26", D(2026, 1, 9), UNICRED, "Despesa", "Valor ruim", "Outros", "abc"),  # 19: valor não numérico
    L("Jan/26", D(2026, 1, 9), UNICRED, "Despesa", "Sem categoria", None, -60.0),  # 20: categoria vazia
]


def xlsx(linhas=None, saldos="padrao", colunas_base=None, nome_aba="Base", abas_extras: dict | None = None) -> bytes:
    """Monta a planilha em memória. saldos=None não cria a aba Saldos_Mensais."""
    linhas = LINHAS_OK if linhas is None else linhas
    saldos = SALDOS_OK if saldos == "padrao" else saldos
    base = pd.DataFrame(linhas, columns=colunas_base or COLUNAS)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        base.to_excel(w, sheet_name=nome_aba, index=False)
        if saldos is not None:
            pd.DataFrame(saldos).to_excel(w, sheet_name="Saldos_Mensais", index=False)
        for nome, df in (abas_extras or {}).items():
            df.to_excel(w, sheet_name=nome, index=False)
    return buf.getvalue()


def previa(client, headers, conteudo: bytes, nome="planilha.xlsx"):
    return client.post("/api/importacoes/previa", files={"arquivo": (nome, conteudo)}, headers=headers)


def importar(client, headers, conteudo: bytes, nome="planilha.xlsx") -> dict:
    """Prévia + confirmação. Devolve a resposta da prévia (JSON) já com a importação confirmada."""
    p = previa(client, headers, conteudo, nome)
    assert p.status_code == 200, p.text
    c = client.post("/api/importacoes/confirmar", json={"token": p.json()["token"]}, headers=headers)
    assert c.status_code == 200, c.text
    return p.json()
