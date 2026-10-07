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
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


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


class Pagamento(Base):
    __tablename__ = "pagamentos"
    __table_args__ = (UniqueConstraint("empresa_id", "documento", "competencia"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"), index=True)
    importacao_id: Mapped[int | None] = mapped_column(ForeignKey("importacoes.id"))
    categoria: Mapped[str] = mapped_column(String(10), index=True)  # receita | despesa
    valor_centavos: Mapped[int] = mapped_column(BigInteger)  # com sinal original
    vencimento: Mapped[date] = mapped_column(Date, index=True)
    pago_em: Mapped[date | None] = mapped_column(Date)
    competencia: Mapped[str] = mapped_column(String(7))  # AAAA-MM
    documento: Mapped[str] = mapped_column(String(60))
    descricao: Mapped[str | None] = mapped_column(String(255))
