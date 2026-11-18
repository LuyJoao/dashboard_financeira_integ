from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StrictInt,
    StringConstraints,
)

NomeCurto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]


class LoginIn(BaseModel):
    email: EmailStr
    senha: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    email: EmailStr
    role: str
    ativo: bool


class UsuarioCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=8)
    role: Literal["admin", "user"] = "user"


class UsuarioUpdate(BaseModel):
    """Edição pelo administrador. Só o que for enviado muda; campo omitido ou null fica como está."""
    nome: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)] | None = None
    email: EmailStr | None = None
    role: Literal["admin", "user"] | None = None
    ativo: bool | None = None


class RedefinirSenhaAdminIn(BaseModel):
    nova_senha: str = Field(min_length=8)


class TrocarSenhaIn(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=8)


class EsqueciSenhaIn(BaseModel):
    email: EmailStr


class RedefinirSenhaIn(BaseModel):
    codigo: str
    nova_senha: str = Field(min_length=8)


# ---------- Importação do Excel (contrato com o front: desktop/src/api/importacoes.ts) ----------
class ErroLinha(BaseModel):
    linha: int
    coluna: str  # erros da aba Saldos_Mensais vêm com o prefixo "Saldos_Mensais · "
    mensagem: str
    aba: str = "Base"
    bruto: dict[str, Any]


class LinhaPrevia(BaseModel):
    linha: int
    situacao: Literal["nova", "atualizada"]
    data: date
    banco: str
    categoria: str
    tipo: str
    descricao: str
    valor: int  # centavos, com sinal


class LinhaAtualizada(BaseModel):
    linha: int
    descricao: str
    mudancas: list[str]


class SaldoSugerido(BaseModel):
    mes: str
    conta: str
    entradas: int
    saidas: int
    saldo_inicial: int | None
    saldo_final_informado: int | None
    lido_do_extrato: bool


class AplicadoSugerido(BaseModel):
    mes: str
    saldo_inicial: int | None
    saldo_final: int | None
    calculado: bool


class Previa(BaseModel):
    token: str
    arquivo_nome: str
    total_linhas: int
    novas: int
    atualizadas: int
    iguais: int
    linhas_erro: int
    periodos: list[str]  # ex.: ["01-2026", "02-2026"]
    categorias: list[str]
    amostra: list[LinhaPrevia]
    atualizadas_detalhe: list[LinhaAtualizada]
    erros: list[ErroLinha]
    saldos: list[SaldoSugerido]
    aplicado: list[AplicadoSugerido]


class LancamentoEdicaoIn(BaseModel):
    data: date
    banco: str
    categoria: str
    tipo: Literal["Receita", "Despesa", "Investimento"]
    descricao: str
    observacao: str
    valor: StrictInt


class Correcao(BaseModel):
    linha: int
    dados: LancamentoEdicaoIn


class ConfirmarIn(BaseModel):
    token: str
    correcoes: list[Correcao] = Field(default_factory=list)


class EmpresaCreate(BaseModel):
    nome: NomeCurto
    tipo: Literal["incubada", "fornecedor"]
    cnpj: str | None = Field(default=None, max_length=20)


class EmpresaOut(BaseModel):
    id: int
    nome: str
    tipo: Literal["incubada", "fornecedor"]
    cnpj: str | None


class CategoriaCreate(BaseModel):
    nome: NomeCurto


class CategoriaOut(BaseModel):
    id: int
    nome: str
    sistema: bool
    em_uso: int


class TituloIn(BaseModel):
    tipo: Literal["pagar", "receber"]
    empresa_id: int
    forma: Literal["NF", "Boleto"]
    numero: str = Field(min_length=1, max_length=80)
    descricao: str = Field(default="", max_length=255)
    valor: StrictInt = Field(gt=0)
    vencimento: date
    pago_em: date | None = None


class TituloOut(BaseModel):
    id: int
    tipo: Literal["pagar", "receber"]
    empresa_id: int
    empresa_nome: str
    forma: Literal["NF", "Boleto"]
    numero: str
    descricao: str
    valor: int
    vencimento: date
    pago_em: date | None


class ImportacaoOut(BaseModel):
    id: int
    arquivo_nome: str
    enviado_em: datetime
    usuario_nome: str
    linhas_total: int
    linhas_novas: int
    linhas_atualizadas: int
    linhas_iguais: int
    linhas_erro: int
    status: Literal["concluida", "concluida_com_erros"]


# ---------- Lançamentos, categorias e empresas ----------
class LancamentoOut(BaseModel):
    id: int
    data: date
    banco: str
    categoria: str
    tipo: Literal["Receita", "Despesa", "Investimento"]
    descricao: str
    observacao: str
    valor: int  # centavos, com sinal


class EmpresaDetalheOut(EmpresaOut):
    qtd_lancamentos: int
    total_centavos: int
    ultimo_lancamento: date | None
    lancamentos: list[LancamentoOut]


class TotaisOut(BaseModel):
    """Medidas das categorias (mesmas fórmulas da aba Categorias da planilha; separadas pelo SINAL do valor)."""
    receitas: int  # soma dos valores positivos
    despesas: int  # soma dos valores negativos (fica negativo)
    despesas_abs: int  # despesas em valor absoluto
    total_movimentado_abs: int  # receitas + despesas_abs


class ResumoCategoriaOut(TotaisOut):
    categoria: str


class FiltrosOut(BaseModel):
    bancos: list[str]
    categorias: list[str]
    tipos: list[str]


# ---------- Dashboard (contrato com o front: desktop/src/api/dashboard.ts) ----------
class LinhaResumo(BaseModel):
    mes: str
    conta: str
    categoria: str
    movimento: Literal["aplicacao", "resgate", "rendimento"] | None
    receitas: int
    despesas: int


class DashboardSaldo(BaseModel):
    mes: str
    conta: str
    saldo_inicial: int
    entradas: int
    saidas: int  # negativo
    saldo_final: int  # saldo_inicial + entradas + saidas
    saldo_informado: int
    diferenca: int  # saldo_final - saldo_informado
    status: Literal["OK", "DIVERGÊNCIA", "NÃO CONFERIDO"]


class SaldoAplicadoMes(BaseModel):
    mes: str
    saldo_inicial: int
    saldo_final: int


class DashboardOut(BaseModel):
    instituicao: str
    atualizado_em: datetime | None  # data e hora da última importação (null se nunca houve)
    contas: list[str]
    categorias: list[str]
    meses: list[str]
    resumo: list[LinhaResumo]
    saldos: list[DashboardSaldo]
    aplicado: list[SaldoAplicadoMes]


class AplicadoMes(SaldoAplicadoMes):
    calculado: int


class DadosSaldos(BaseModel):
    contas: list[str]
    meses: list[str]
    saldos: list[DashboardSaldo]
    aplicado: list[AplicadoMes]
