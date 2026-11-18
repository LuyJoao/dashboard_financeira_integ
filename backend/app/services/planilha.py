"""Leitura tolerante e validação da aba Base de planilhas .xlsx."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from io import BytesIO
from typing import Any

import pandas as pd

ABA = "Base"
MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
TIPOS = {"receita": "Receita", "despesa": "Despesa", "investimento": "Investimento"}
OBS_APLICACAO = ("Investimento", "Rendimento", "Resgate")
CATEGORIA_APLICACAO = "Aplicação Financeira"

_CAMPOS = {
    "data": {"data"},
    "banco": {"banco", "conta"},
    "tipo": {"tipo"},
    "documento": {"documento"},
    "descricao": {"discriminacao", "discriminacao original"},
    "categoria": {"categoria"},
    "observacao": {"observacao"},
    "valor": {"valor"},
    "saldo_apos": {"saldo apos lancamento"},
    "mes": {"mes"},
    "cod_operacao": {"cod op ban", "codigo operacao bancaria"},
}
_OBRIGATORIOS = ("data", "banco", "tipo", "descricao", "categoria", "valor")
_NOMES = {
    "data": "Data",
    "banco": "Banco",
    "tipo": "Tipo",
    "documento": "Documento",
    "descricao": "Discriminação",
    "categoria": "Categoria",
    "observacao": "Observação",
    "valor": "Valor",
    "saldo_apos": "Saldo Após Lançamento",
    "mes": "Mês",
    "cod_operacao": "Cód. Op. Ban.",
}
_LIMITES = {"banco": 40, "categoria": 80, "descricao": 255, "observacao": 255, "documento": 255, "cod_operacao": 30}
_RE_EMPRESA = re.compile(r"^\s*empresa\s+(.+?)\s*$", re.IGNORECASE)


class PlanilhaInvalida(Exception):
    """Problema estrutural no arquivo (formato, aba ou cabeçalhos)."""


@dataclass
class Linha:
    linha: int
    data: date
    competencia: str
    banco: str
    tipo: str
    categoria: str
    descricao: str
    observacao: str | None
    documento: str | None
    cod_operacao: str | None
    valor_centavos: int
    saldo_apos_centavos: int | None
    ordem_extrato: int
    bruto: dict[str, Any]
    assinatura: str | None = None
    ordem_repeticao: int | None = None

    @property
    def empresa(self) -> str | None:
        match = _RE_EMPRESA.match(self.observacao or "")
        return match.group(1).strip() if match else None


@dataclass
class ErroLinha:
    linha: int
    coluna: str
    mensagem: str
    bruto: dict[str, Any]
    aba: str = ABA


@dataclass
class Resultado:
    total: int = 0
    linhas: list[Linha] = field(default_factory=list)
    erros: list[ErroLinha] = field(default_factory=list)

    @property
    def linhas_com_erro(self) -> int:
        return len({erro.linha for erro in self.erros})


def _normalizar_cabecalho(valor: Any) -> str:
    texto = "".join(
        char for char in unicodedata.normalize("NFKD", str(valor)) if not unicodedata.combining(char)
    ).casefold()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return " ".join(texto.split())


def _vazio(valor: Any) -> bool:
    if valor is None:
        return True
    try:
        return bool(pd.isna(valor))
    except (TypeError, ValueError):
        return False


def _texto(valor: Any) -> str | None:
    if _vazio(valor):
        return None
    texto = str(valor).strip()
    return texto or None


def _texto_original(valor: Any) -> str | None:
    if _vazio(valor):
        return None
    texto = str(valor)
    return texto if texto.strip() else None


def _bruto(valor: Any) -> Any:
    if _vazio(valor):
        return None
    if isinstance(valor, (datetime, date, pd.Timestamp)):
        return valor.date().isoformat() if isinstance(valor, datetime) else valor.isoformat()
    if isinstance(valor, (int, float, str, bool)):
        return valor
    return str(valor)


def _data(valor: Any) -> date | None:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str):
        for formato in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
            try:
                return datetime.strptime(valor.strip(), formato).date()
            except ValueError:
                continue
    return None


def _centavos(valor: Any, estrito: bool = True) -> int:
    if isinstance(valor, bool):
        raise ValueError("não é um número")
    if isinstance(valor, str):
        texto = valor.strip().replace("R$", "").replace(" ", "")
        if "," in texto:
            texto = texto.replace(".", "").replace(",", ".")
        valor = texto
    try:
        decimal = Decimal(str(valor))
    except (InvalidOperation, ValueError):
        raise ValueError(f"'{valor}' não é um número") from None
    if not decimal.is_finite():
        raise ValueError("não é um número")
    arredondado = decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if estrito and abs(decimal - arredondado) > Decimal("0.0001"):
        raise ValueError("use no máximo 2 casas decimais")
    return int(arredondado * 100)


def competencia_da_data(data: date) -> str:
    return f"{data.year:04d}-{data.month:02d}"


def parse_competencia(valor: str) -> str | None:
    texto = valor.strip()
    if re.fullmatch(r"(0[1-9]|1[0-2])-\d{4}", texto):
        mes, ano = texto.split("-")
        return f"{ano}-{mes}"
    if re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", texto):
        return texto
    match = re.fullmatch(r"([A-Za-zÀ-ÿ]{3})/(\d{2}|\d{4})", texto)
    if match:
        nomes = {mes.casefold(): index for index, mes in enumerate(MESES, start=1)}
        numero_mes = nomes.get(match.group(1).casefold())
        if numero_mes:
            ano = match.group(2)
            ano = f"20{ano}" if len(ano) == 2 else ano
            return f"{ano}-{numero_mes:02d}"
    return None


def formatar_periodo(competencia: str) -> str:
    """Converte competência interna AAAA-MM para o formato de API MM-AAAA."""
    ano, mes = competencia.split("-")
    return f"{mes}-{ano}"


def _mapear_colunas(colunas: list[Any]) -> dict[str, Any]:
    normalizadas = {_normalizar_cabecalho(coluna): coluna for coluna in colunas}
    mapa = {}
    for campo, aliases in _CAMPOS.items():
        for alias in aliases:
            if alias in normalizadas:
                mapa[campo] = normalizadas[alias]
                break
    faltando = [_NOMES[campo] for campo in _OBRIGATORIOS if campo not in mapa]
    if faltando:
        raise PlanilhaInvalida("Colunas obrigatórias ausentes na aba Base: " + ", ".join(faltando) + ".")
    return mapa


def ler_planilha(conteudo: bytes) -> Resultado:
    try:
        workbook = pd.ExcelFile(BytesIO(conteudo), engine="openpyxl")
    except Exception:
        raise PlanilhaInvalida("O arquivo não é uma planilha .xlsx válida.") from None
    if ABA not in workbook.sheet_names:
        raise PlanilhaInvalida(f'A planilha precisa ter uma aba chamada "{ABA}".')

    dataframe = workbook.parse(ABA, dtype=object)
    mapa = _mapear_colunas(list(dataframe.columns))
    resultado = Resultado()

    for indice, row in dataframe.iterrows():
        if all(_vazio(valor) for valor in row.values):
            continue
        resultado.total += 1
        numero_linha = int(indice) + 2
        bruto = {
            "data": _bruto(row[mapa["data"]]),
            "banco": _bruto(row[mapa["banco"]]) or "",
            "categoria": _bruto(row[mapa["categoria"]]) or "",
            "tipo": _bruto(row[mapa["tipo"]]) or "",
            "descricao": _bruto(row[mapa["descricao"]]) or "",
            "observacao": _bruto(row[mapa["observacao"]]) if "observacao" in mapa else "",
            "valor": _bruto(row[mapa["valor"]]),
            "documento": _bruto(row[mapa["documento"]]) if "documento" in mapa else None,
            "cod_operacao": _bruto(row[mapa["cod_operacao"]]) if "cod_operacao" in mapa else None,
            "saldo_apos_lancamento": _bruto(row[mapa["saldo_apos"]]) if "saldo_apos" in mapa else None,
        }
        erros: list[tuple[str, str]] = []

        def erro(campo: str, mensagem: str) -> None:
            erros.append((_NOMES[campo], mensagem))

        textos: dict[str, str | None] = {}
        for campo in ("banco", "categoria", "descricao", "observacao", "documento", "cod_operacao"):
            coluna = mapa.get(campo)
            texto = (
                _texto_original(row[coluna]) if campo in ("descricao", "documento") else _texto(row[coluna])
            ) if coluna is not None else None
            if campo in ("banco", "categoria", "descricao") and texto is None:
                erro(campo, "Campo obrigatório")
            elif texto is not None and len(texto) > _LIMITES[campo]:
                erro(campo, f"Texto maior que {_LIMITES[campo]} caracteres")
            textos[campo] = texto

        dt = _data(row[mapa["data"]])
        if dt is None:
            erro("data", f"Data inválida: '{bruto['data']}' (use DD/MM/AAAA)")
        elif dt < date(2026, 1, 1):
            erro("data", "A data deve ser a partir de 01/01/2026.")

        competencia = competencia_da_data(dt) if dt else None
        if "mes" in mapa and not _vazio(row[mapa["mes"]]):
            mes_planilha = _texto(row[mapa["mes"]]) or ""
            competencia_planilha = parse_competencia(mes_planilha)
            if not competencia_planilha:
                erro("mes", f"Mês inválido: '{mes_planilha}'.")
            elif competencia and competencia_planilha != competencia:
                erro("mes", f"Mês '{mes_planilha}' não corresponde à data {dt.strftime('%d/%m/%Y')}.")

        tipo_txt = _texto(row[mapa["tipo"]])
        tipo = TIPOS.get(tipo_txt.casefold()) if tipo_txt else None
        if tipo is None:
            erro("tipo", f"Tipo inválido: '{tipo_txt or ''}' (use Receita, Despesa ou Investimento).")

        try:
            valor_centavos = _centavos(row[mapa["valor"]])
        except ValueError as exc:
            valor_centavos = None
            erro("valor", f"Valor inválido: {exc}")
        if valor_centavos is not None:
            if valor_centavos == 0:
                erro("valor", "Valor não pode ser zero.")
            elif tipo == "Receita" and valor_centavos < 0:
                erro("valor", "Receita deve ter valor positivo.")
            elif tipo in ("Despesa", "Investimento") and valor_centavos > 0:
                erro("valor", f"{tipo} deve ter valor negativo.")

        observacao = textos["observacao"]
        if textos["categoria"] and textos["categoria"].casefold() == CATEGORIA_APLICACAO.casefold():
            obs_normalizada = next((obs for obs in OBS_APLICACAO if obs.casefold() == (observacao or "").casefold()), None)
            if obs_normalizada is None:
                erro("observacao", 'Em "Aplicação Financeira", use Investimento, Rendimento ou Resgate.')
            else:
                observacao = obs_normalizada
                if valor_centavos is not None:
                    if observacao == "Investimento" and valor_centavos > 0:
                        erro("valor", "Investimento deve ter valor negativo.")
                    elif observacao != "Investimento" and valor_centavos < 0:
                        erro("valor", f"{observacao} deve ter valor positivo.")

        saldo_apos = None
        if "saldo_apos" in mapa and not _vazio(row[mapa["saldo_apos"]]):
            try:
                saldo_apos = _centavos(row[mapa["saldo_apos"]], estrito=False)
            except ValueError as exc:
                erro("saldo_apos", f"Valor inválido: {exc}")

        if erros:
            resultado.erros.extend(
                ErroLinha(numero_linha, coluna, mensagem, bruto)
                for coluna, mensagem in erros
            )
            continue

        documento = textos["documento"]
        cod_operacao = textos["cod_operacao"]
        resultado.linhas.append(
            Linha(
                linha=numero_linha,
                data=dt,
                competencia=competencia,
                banco=textos["banco"],
                tipo=tipo,
                categoria=textos["categoria"],
                descricao=textos["descricao"],
                observacao=observacao,
                documento=documento,
                cod_operacao=cod_operacao,
                valor_centavos=valor_centavos,
                saldo_apos_centavos=saldo_apos,
                ordem_extrato=numero_linha,
                bruto=bruto,
            )
        )
    return resultado
