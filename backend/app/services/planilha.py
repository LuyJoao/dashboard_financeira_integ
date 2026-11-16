"""Leitura e validação da aba "Base" da planilha financeira da INTEG.

Não grava nada: só transforma o arquivo em linhas válidas + erros por linha.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from io import BytesIO

import pandas as pd

ABA = "Base"
ABA_SALDOS = "Saldos_Mensais"  # opcional: saldo inicial e saldo final informado, digitados à mão
MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
TIPOS = {"receita": "Receita", "despesa": "Despesa", "investimento": "Investimento"}

# nome na planilha -> campo interno
COLUNAS_OBRIGATORIAS = {
    "mês": "mes",
    "data": "data",
    "banco": "banco",
    "tipo": "tipo",
    "discriminação (original)": "descricao",
    "categoria": "categoria",
    "valor": "valor",
}
COLUNAS_OPCIONAIS = {
    "cód. op. ban.": "cod_operacao",
    "documento": "documento",
    "observação": "observacao",
    "saldo após lançamento": "saldo_apos",
}

COLUNAS_SALDOS = {
    "mês": "mes",
    "banco": "banco",
    "saldo inicial": "saldo_inicial",
    "saldo final informado": "saldo_informado",
}
NOME_COLUNA_SALDOS = {"mes": "Mês", "banco": "Banco", "saldo_inicial": "Saldo Inicial", "saldo_informado": "Saldo Final Informado"}

LIMITES = {"banco": 40, "categoria": 80, "descricao": 255, "observacao": 255, "documento": 60, "cod_operacao": 30}
NOME_COLUNA = {  # como o usuário vê na planilha (usado nas mensagens de erro)
    "mes": "Mês", "data": "Data", "banco": "Banco", "tipo": "Tipo", "descricao": "Discriminação (original)",
    "categoria": "Categoria", "valor": "Valor", "cod_operacao": "Cód. Op. Ban.", "documento": "Documento",
    "observacao": "Observação", "saldo_apos": "Saldo Após Lançamento",
}

_RE_MES = re.compile(r"^(" + "|".join(MESES) + r")/(\d{2})$", re.IGNORECASE)
_RE_EMPRESA = re.compile(r"^\s*empresa\s+(.+?)\s*$", re.IGNORECASE)


class PlanilhaInvalida(Exception):
    """Problema estrutural no arquivo (não é .xlsx, sem aba Base, falta coluna...)."""


@dataclass
class Linha:
    linha: int  # número da linha na planilha (cabeçalho = 1)
    data: date
    competencia: str  # AAAA-MM
    banco: str
    tipo: str
    categoria: str
    descricao: str
    observacao: str | None
    documento: str | None
    cod_operacao: str | None
    valor_centavos: int
    saldo_apos_centavos: int | None
    empresa: str | None


@dataclass
class Saldo:
    linha: int  # número da linha na aba Saldos_Mensais
    competencia: str  # AAAA-MM
    banco: str
    saldo_inicial_centavos: int
    saldo_informado_centavos: int


@dataclass
class ErroLinha:
    linha: int
    coluna: str
    mensagem: str
    aba: str = ABA


@dataclass
class Resultado:
    total: int = 0
    linhas: list[Linha] = field(default_factory=list)
    erros: list[ErroLinha] = field(default_factory=list)  # só da aba Base
    saldos: list[Saldo] = field(default_factory=list)
    erros_saldos: list[ErroLinha] = field(default_factory=list)  # da aba Saldos_Mensais

    @property
    def linhas_com_erro(self) -> int:
        return len({e.linha for e in self.erros})

    @property
    def saldos_com_erro(self) -> int:
        return len({e.linha for e in self.erros_saldos})


# ---------- conversões ----------
def _vazio(v) -> bool:
    return v is None or (not isinstance(v, str) and pd.isna(v)) or (isinstance(v, str) and not v.strip())


def _txt(v) -> str | None:
    return None if _vazio(v) else str(v).strip()


def _cod(v) -> str | None:
    if _vazio(v):
        return None
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def _data(v) -> date | None:
    if isinstance(v, datetime):  # inclui pd.Timestamp
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
            try:
                return datetime.strptime(v.strip(), fmt).date()
            except ValueError:
                pass
    return None


def _centavos(v, estrito: bool) -> int:
    """Converte para centavos. Levanta ValueError com mensagem amigável."""
    if isinstance(v, bool):
        raise ValueError("não é um número")
    if isinstance(v, str):
        s = v.strip().replace("R$", "").replace(" ", "")
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        v = s
    try:
        d = Decimal(str(v))
    except InvalidOperation:
        raise ValueError(f"'{v}' não é um número") from None
    if not d.is_finite():
        raise ValueError("não é um número")
    q = d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if estrito and abs(d - q) > Decimal("0.0001"):
        raise ValueError("use no máximo 2 casas decimais")
    return int(q * 100)


# ---------- leitura ----------
def ler_planilha(conteudo: bytes) -> Resultado:
    try:
        xls = pd.ExcelFile(BytesIO(conteudo), engine="openpyxl")
    except Exception:
        raise PlanilhaInvalida("O arquivo não é uma planilha .xlsx válida.") from None
    if ABA not in xls.sheet_names:
        raise PlanilhaInvalida(f'A planilha precisa ter uma aba chamada "{ABA}".')

    df = xls.parse(ABA, dtype=object)
    cols = {str(c).strip().lower(): c for c in df.columns}
    faltando = [NOME_COLUNA[campo] for nome, campo in COLUNAS_OBRIGATORIAS.items() if nome not in cols]
    if faltando:
        raise PlanilhaInvalida("Colunas obrigatórias ausentes na aba Base: " + ", ".join(faltando) + ".")
    mapa = {campo: cols[nome] for nome, campo in {**COLUNAS_OBRIGATORIAS, **COLUNAS_OPCIONAIS}.items() if nome in cols}

    res = Resultado()
    for idx, row in df.iterrows():
        if all(_vazio(v) for v in row.values):
            continue  # linha em branco no fim da planilha
        res.total += 1
        linha_n = int(idx) + 2  # cabeçalho é a linha 1
        erros: list[ErroLinha] = []

        def erro(campo: str, msg: str) -> None:
            erros.append(ErroLinha(linha_n, NOME_COLUNA[campo], msg))

        def valor(campo: str):
            return row[mapa[campo]] if campo in mapa else None

        # textos obrigatórios / opcionais
        textos: dict[str, str | None] = {}
        for campo in ("banco", "categoria", "descricao", "observacao", "documento"):
            t = _txt(valor(campo))
            if t is None and campo in COLUNAS_OBRIGATORIAS.values():
                erro(campo, "Campo obrigatório")
            elif t is not None and len(t) > LIMITES[campo]:
                erro(campo, f"Texto maior que {LIMITES[campo]} caracteres")
            textos[campo] = t
        cod = _cod(valor("cod_operacao"))
        if cod is not None and len(cod) > LIMITES["cod_operacao"]:
            erro("cod_operacao", f"Texto maior que {LIMITES['cod_operacao']} caracteres")

        # data
        dt = None
        if _vazio(valor("data")):
            erro("data", "Campo obrigatório")
        else:
            dt = _data(valor("data"))
            if dt is None:
                erro("data", f"Data inválida: '{valor('data')}' (use DD/MM/AAAA)")

        # mês (competência) e coerência com a data
        competencia = None
        mes_txt = _txt(valor("mes"))
        if mes_txt is None:
            erro("mes", "Campo obrigatório")
        else:
            m = _RE_MES.match(mes_txt)
            if not m:
                erro("mes", f"Mês inválido: '{mes_txt}' (use o formato Jan/26)")
            else:
                mes_n = [x.lower() for x in MESES].index(m.group(1).lower()) + 1
                competencia = f"{2000 + int(m.group(2))}-{mes_n:02d}"
                if dt is not None and competencia != f"{dt.year}-{dt.month:02d}":
                    erro("mes", f"Mês '{mes_txt}' não corresponde à data {dt.strftime('%d/%m/%Y')}")

        # tipo
        tipo = None
        tipo_txt = _txt(valor("tipo"))
        if tipo_txt is None:
            erro("tipo", "Campo obrigatório")
        else:
            tipo = TIPOS.get(tipo_txt.lower())
            if tipo is None:
                erro("tipo", f"Tipo inválido: '{tipo_txt}' (use Receita, Despesa ou Investimento)")

        # valor e coerência do sinal com o tipo
        centavos = None
        if _vazio(valor("valor")):
            erro("valor", "Campo obrigatório")
        else:
            try:
                centavos = _centavos(valor("valor"), estrito=True)
            except ValueError as e:
                erro("valor", f"Valor inválido: {e}")
        if centavos is not None:
            if centavos == 0:
                erro("valor", "Valor não pode ser zero")
            elif tipo == "Receita" and centavos < 0:
                erro("valor", "Receita deve ter valor positivo")
            elif tipo == "Despesa" and centavos > 0:
                erro("valor", "Despesa deve ter valor negativo")

        # saldo (opcional, tolerante)
        saldo = None
        if not _vazio(valor("saldo_apos")):
            try:
                saldo = _centavos(valor("saldo_apos"), estrito=False)
            except ValueError as e:
                erro("saldo_apos", f"Valor inválido: {e}")

        if erros:
            res.erros.extend(erros)
            continue

        obs = textos["observacao"]
        m_emp = _RE_EMPRESA.match(obs) if obs else None
        res.linhas.append(Linha(
            linha=linha_n, data=dt, competencia=competencia, banco=textos["banco"], tipo=tipo,
            categoria=textos["categoria"], descricao=textos["descricao"], observacao=obs,
            documento=textos["documento"], cod_operacao=cod, valor_centavos=centavos,
            saldo_apos_centavos=saldo, empresa=m_emp.group(1) if m_emp else None,
        ))

    if ABA_SALDOS in xls.sheet_names:
        res.saldos, res.erros_saldos = _ler_saldos(xls.parse(ABA_SALDOS, dtype=object))
    return res


def _ler_saldos(df: pd.DataFrame) -> tuple[list[Saldo], list[ErroLinha]]:
    """Lê "Mês", "Banco", "Saldo Inicial" e "Saldo Final Informado". As demais colunas da aba são
    fórmulas calculadas a partir da Base e são ignoradas (o sistema recalcula)."""
    cols = {str(c).strip().lower(): c for c in df.columns}
    faltando = [NOME_COLUNA_SALDOS[campo] for nome, campo in COLUNAS_SALDOS.items() if nome not in cols]
    if faltando:
        raise PlanilhaInvalida(f"Colunas ausentes na aba {ABA_SALDOS}: " + ", ".join(faltando) + ".")
    mapa = {campo: cols[nome] for nome, campo in COLUNAS_SALDOS.items()}

    saldos: list[Saldo] = []
    erros: list[ErroLinha] = []
    vistos: set[tuple[str, str]] = set()
    for idx, row in df.iterrows():
        if all(_vazio(row[c]) for c in mapa.values()):
            continue
        linha_n = int(idx) + 2
        erros_linha: list[ErroLinha] = []

        def erro(campo: str, msg: str) -> None:
            erros_linha.append(ErroLinha(linha_n, NOME_COLUNA_SALDOS[campo], msg, ABA_SALDOS))

        competencia = None
        mes_txt = _txt(row[mapa["mes"]])
        if mes_txt is None:
            erro("mes", "Campo obrigatório")
        else:
            m = _RE_MES.match(mes_txt)
            if not m:
                erro("mes", f"Mês inválido: '{mes_txt}' (use o formato Jan/26)")
            else:
                mes_n = [x.lower() for x in MESES].index(m.group(1).lower()) + 1
                competencia = f"{2000 + int(m.group(2))}-{mes_n:02d}"

        banco = _txt(row[mapa["banco"]])
        if banco is None:
            erro("banco", "Campo obrigatório")
        elif len(banco) > LIMITES["banco"]:
            erro("banco", f"Texto maior que {LIMITES['banco']} caracteres")

        valores: dict[str, int] = {}
        for campo in ("saldo_inicial", "saldo_informado"):
            if _vazio(row[mapa[campo]]):
                erro(campo, "Campo obrigatório")
                continue
            try:
                valores[campo] = _centavos(row[mapa[campo]], estrito=False)  # tolera 1620.15999999999
            except ValueError as e:
                erro(campo, f"Valor inválido: {e}")

        if competencia and banco and not erros_linha:
            if (competencia, banco) in vistos:
                erro("mes", f"Combinação Mês/Banco repetida ({mes_txt} · {banco})")
            vistos.add((competencia, banco))

        if erros_linha:
            erros.extend(erros_linha)
            continue
        saldos.append(Saldo(linha_n, competencia, banco, valores["saldo_inicial"], valores["saldo_informado"]))
    return saldos, erros


def formatar_periodo(competencia: str) -> str:
    """'2026-01' -> 'Jan/26'"""
    ano, mes = competencia.split("-")
    return f"{MESES[int(mes) - 1]}/{ano[2:]}"
