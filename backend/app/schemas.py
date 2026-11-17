from datetime import date, datetime
from typing import Literal

from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints


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


class LinhaPrevia(BaseModel):
    linha: int
    data: date
    banco: str
    categoria: str
    tipo: str
    descricao: str
    valor: int  # centavos, com sinal
    empresa: str | None = None  # extra (opcional): vem da Observação "Empresa X"


class Previa(BaseModel):
    token: str
    arquivo_nome: str
    total_linhas: int
    linhas_ok: int
    linhas_erro: int
    saldos_ok: int = 0  # extra: linhas válidas da aba Saldos_Mensais (opcional na planilha)
    saldos_erro: int = 0
    linhas_substituidas: int  # extra: lançamentos já gravados nesses meses, que serão substituídos
    periodos: list[str]  # ex.: ["Jan/26", "Fev/26"]
    amostra: list[LinhaPrevia]
    erros: list[ErroLinha]


class ConfirmarIn(BaseModel):
    token: str


class ImportacaoOut(BaseModel):
    id: int
    arquivo_nome: str
    enviado_em: datetime
    usuario_nome: str
    linhas_total: int
    linhas_ok: int
    linhas_erro: int
    status: Literal["concluida", "concluida_com_erros"]


# ---------- Lançamentos, categorias e empresas ----------
class LancamentoOut(BaseModel):
    id: int
    data: date
    banco: str
    categoria: str
    tipo: str
    descricao: str
    valor: int  # centavos, com sinal
    empresa_id: int | None = None
    empresa: str | None = None


class TotaisOut(BaseModel):
    """Medidas das categorias (mesmas fórmulas da aba Categorias da planilha; separadas pelo SINAL do valor)."""
    receitas: int  # soma dos valores positivos
    despesas: int  # soma dos valores negativos (fica negativo)
    despesas_abs: int  # despesas em valor absoluto
    total_movimentado_abs: int  # receitas + despesas_abs


class ResumoCategoriaOut(TotaisOut):
    categoria: str


class LancamentosPagina(BaseModel):
    itens: list[LancamentoOut]
    total: int  # linhas que atendem aos filtros (todas as páginas)
    pagina: int
    tamanho: int
    paginas: int
    totais: TotaisOut  # calculados sobre TODAS as linhas filtradas, não só a página


class FiltrosOut(BaseModel):
    bancos: list[str]
    categorias: list[str]
    tipos: list[str]


class EmpresaOut(BaseModel):
    id: int
    nome: str
    cnpj: str | None = None
    qtd_lancamentos: int
    total_centavos: int
    ultimo_lancamento: date | None = None


class EmpresasPagina(BaseModel):
    itens: list[EmpresaOut]
    total: int
    pagina: int
    tamanho: int
    paginas: int


class EmpresaDetalhe(EmpresaOut):
    lancamentos: list[LancamentoOut]  # do mais recente para o mais antigo


# ---------- Dashboard (contrato com o front: desktop/src/api/dashboard.ts) ----------
class DashboardMes(BaseModel):
    mes: str  # "Jan/26"
    receitas: int
    despesas: int  # negativo
    aplicacoes: int  # negativo: dinheiro que saiu da conta para investir
    resgates: int  # positivo: dinheiro que voltou do investimento


class DashboardCategoria(BaseModel):
    categoria: str
    receitas: int
    despesas: int  # negativo


class DashboardSaldo(BaseModel):
    mes: str
    conta: str
    saldo_inicial: int
    entradas: int
    saidas: int  # negativo
    saldo_final: int  # saldo_inicial + entradas + saidas
    saldo_informado: int
    diferenca: int  # saldo_final - saldo_informado
    status: Literal["OK", "DIVERGÊNCIA"]


class DashboardOut(BaseModel):
    instituicao: str
    atualizado_em: datetime | None  # data e hora da última importação (null se nunca houve)
    contas: list[str]
    meses: list[DashboardMes]
    categorias: list[DashboardCategoria]
    saldos: list[DashboardSaldo]
