import io
from datetime import date

import pandas as pd


COLUNAS = [
    "Data",
    "Banco",
    "Tipo",
    "Documento",
    "Discriminação",
    "Categoria",
    "Observação",
    "Valor",
    "Saldo Após Lançamento",
]


def linha(
    data: date,
    banco: str,
    tipo: str,
    descricao: str,
    categoria: str,
    valor: float,
    observacao: str = "",
    documento: str = "",
    saldo_apos: float | None = None,
) -> dict:
    return {
        "Data": data,
        "Banco": banco,
        "Tipo": tipo,
        "Documento": documento,
        "Discriminação": descricao,
        "Categoria": categoria,
        "Observação": observacao,
        "Valor": valor,
        "Saldo Após Lançamento": saldo_apos,
    }


def xlsx(linhas: list[dict], colunas: list[str] | None = None) -> bytes:
    buffer = io.BytesIO()
    frame = pd.DataFrame(linhas)
    if colunas is not None:
        frame = frame[colunas]
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        frame.to_excel(writer, sheet_name="Base", index=False)
    return buffer.getvalue()
