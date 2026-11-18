from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
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
    tipo: Mapped[str] = mapped_column(String(12), default="incubada")
    cnpj: Mapped[str | None] = mapped_column(String(20), unique=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Conta(Base):
    __tablename__ = "contas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    nome: Mapped[str] = mapped_column(String(40), unique=True)


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(80))
    sistema: Mapped[bool] = mapped_column(Boolean, default=False)


class Importacao(Base):
    __tablename__ = "importacoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    arquivo_nome: Mapped[str] = mapped_column(String(255))
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    linhas_total: Mapped[int] = mapped_column(default=0)
    linhas_ok: Mapped[int] = mapped_column(default=0)
    linhas_erro: Mapped[int] = mapped_column(default=0)
    linhas_novas: Mapped[int] = mapped_column(default=0)
    linhas_atualizadas: Mapped[int] = mapped_column(default=0)
    linhas_iguais: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(20), default="concluida")


class Lancamento(Base):
    """Linha do extrato bancário consolidado (aba "Base" da planilha financeira)."""

    __tablename__ = "lancamentos"

    id: Mapped[int] = mapped_column(primary_key=True)
    importacao_id: Mapped[int | None] = mapped_column(ForeignKey("importacoes.id"), index=True)
    empresa_id: Mapped[int | None] = mapped_column(ForeignKey("empresas.id"), index=True)  # só nas Taxas de Incubação
    conta_id: Mapped[int] = mapped_column(ForeignKey("contas.id"), index=True)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"), index=True)
    competencia: Mapped[str] = mapped_column(String(7), index=True)  # AAAA-MM (coluna "Mês")
    data: Mapped[date] = mapped_column(Date, index=True)
    banco: Mapped[str] = mapped_column(String(40))  # ex.: "104 - Caixa"
    tipo: Mapped[str] = mapped_column(String(15), index=True)  # Receita | Despesa | Investimento
    categoria: Mapped[str] = mapped_column(String(80), index=True)  # texto livre
    descricao: Mapped[str] = mapped_column(String(255))  # "Discriminação (original)"
    observacao: Mapped[str | None] = mapped_column(String(255))
    documento: Mapped[str | None] = mapped_column(String(255))
    cod_operacao: Mapped[str | None] = mapped_column(String(30))
    valor_centavos: Mapped[int] = mapped_column(BigInteger)  # com sinal original
    saldo_apos_centavos: Mapped[int | None] = mapped_column(BigInteger)
    origem: Mapped[str] = mapped_column(String(12), default="importado")
    assinatura: Mapped[str | None] = mapped_column(String(64), index=True)
    ordem_repeticao: Mapped[int | None] = mapped_column(Integer)
    ordem_extrato: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint("assinatura", "ordem_repeticao", name="uq_lancamento_assinatura_repeticao"),
    )


class SaldoMensal(Base):
    """Saldo importado por mês e conta, preservado para compatibilidade e auditoria."""

    __tablename__ = "saldos_mensais"
    __table_args__ = (UniqueConstraint("competencia", "banco", name="uq_saldo_competencia_banco"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    importacao_id: Mapped[int | None] = mapped_column(ForeignKey("importacoes.id"), index=True)
    conta_id: Mapped[int] = mapped_column(ForeignKey("contas.id"), index=True)
    competencia: Mapped[str] = mapped_column(String(7), index=True)  # AAAA-MM
    banco: Mapped[str] = mapped_column(String(40))
    saldo_inicial_centavos: Mapped[int] = mapped_column(BigInteger)
    saldo_informado_centavos: Mapped[int | None] = mapped_column(BigInteger)
    origem_valor: Mapped[str] = mapped_column(String(20), default="extrato")


class Titulo(Base):
    __tablename__ = "titulos"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(10), index=True)
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"), index=True)
    forma: Mapped[str] = mapped_column(String(10))
    numero: Mapped[str] = mapped_column(String(80))
    descricao: Mapped[str] = mapped_column(String(255), default="")
    valor_centavos: Mapped[int] = mapped_column(BigInteger)
    vencimento: Mapped[date] = mapped_column(Date, index=True)
    pago_em: Mapped[date | None] = mapped_column(Date, nullable=True)


Index("uq_empresas_nome_lower", func.lower(Empresa.nome), unique=True)
Index("uq_categorias_nome_lower", func.lower(Categoria.nome), unique=True)
