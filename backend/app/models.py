from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="user")  # admin | user
    ativo: Mapped[bool] = mapped_column(default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ResetSenha(Base):
    __tablename__ = "reset_senha"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # também marca o código como invalidado
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Empresa(Base):
    __tablename__ = "empresas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(200))
    cnpj: Mapped[str | None] = mapped_column(String(20), unique=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Importacao(Base):
    __tablename__ = "importacoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    arquivo_nome: Mapped[str] = mapped_column(String(255))
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    linhas_total: Mapped[int] = mapped_column(default=0)
    linhas_ok: Mapped[int] = mapped_column(default=0)
    linhas_erro: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(20), default="concluida")


class Lancamento(Base):
    """Linha do extrato bancário consolidado (aba "Base" da planilha financeira)."""

    __tablename__ = "lancamentos"

    id: Mapped[int] = mapped_column(primary_key=True)
    importacao_id: Mapped[int] = mapped_column(ForeignKey("importacoes.id"), index=True)
    empresa_id: Mapped[int | None] = mapped_column(ForeignKey("empresas.id"), index=True)  # só nas Taxas de Incubação
    competencia: Mapped[str] = mapped_column(String(7), index=True)  # AAAA-MM (coluna "Mês")
    data: Mapped[date] = mapped_column(Date, index=True)
    banco: Mapped[str] = mapped_column(String(40))  # ex.: "104 - Caixa"
    tipo: Mapped[str] = mapped_column(String(15), index=True)  # Receita | Despesa | Investimento
    categoria: Mapped[str] = mapped_column(String(80), index=True)  # texto livre
    descricao: Mapped[str] = mapped_column(String(255))  # "Discriminação (original)"
    observacao: Mapped[str | None] = mapped_column(String(255))
    documento: Mapped[str | None] = mapped_column(String(60))
    cod_operacao: Mapped[str | None] = mapped_column(String(30))
    valor_centavos: Mapped[int] = mapped_column(BigInteger)  # com sinal original
    saldo_apos_centavos: Mapped[int | None] = mapped_column(BigInteger)


class SaldoMensal(Base):
    """Saldos digitados à mão na aba "Saldos_Mensais": base da conciliação bancária do dashboard."""

    __tablename__ = "saldos_mensais"
    __table_args__ = (UniqueConstraint("competencia", "banco", name="uq_saldo_competencia_banco"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    importacao_id: Mapped[int] = mapped_column(ForeignKey("importacoes.id"), index=True)
    competencia: Mapped[str] = mapped_column(String(7), index=True)  # AAAA-MM
    banco: Mapped[str] = mapped_column(String(40))
    saldo_inicial_centavos: Mapped[int] = mapped_column(BigInteger)
    saldo_informado_centavos: Mapped[int] = mapped_column(BigInteger)  # "Saldo Final Informado" (do extrato)
