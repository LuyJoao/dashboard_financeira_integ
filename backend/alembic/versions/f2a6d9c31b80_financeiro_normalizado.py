"""Add fixed accounts, categories, transaction identity and titles.

Revision ID: f2a6d9c31b80
Revises: 7d7322fd410e
"""
import hashlib
import json
from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a6d9c31b80"
down_revision: Union[str, Sequence[str], None] = "7d7322fd410e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _assinatura(banco, data, descricao, valor, documento):
    partes = [banco, data.isoformat(), descricao, int(valor), documento]
    serializado = json.dumps(partes, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(serializado).hexdigest()


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "contas",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("nome", sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nome"),
    )
    op.bulk_insert(
        sa.table("contas", sa.column("id", sa.Integer()), sa.column("nome", sa.String())),
        [
            {"id": 104, "nome": "104 - Caixa"},
            {"id": 136, "nome": "136 - Unicred"},
            {"id": 341, "nome": "341 - Itaú"},
        ],
    )

    op.create_table(
        "categorias",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(length=80), nullable=False),
        sa.Column("sistema", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("empresas", sa.Column("tipo", sa.String(length=12), server_default="incubada", nullable=False))
    op.add_column("importacoes", sa.Column("linhas_novas", sa.Integer(), server_default="0", nullable=False))
    op.add_column("importacoes", sa.Column("linhas_atualizadas", sa.Integer(), server_default="0", nullable=False))
    op.add_column("importacoes", sa.Column("linhas_iguais", sa.Integer(), server_default="0", nullable=False))
    bind.execute(
        sa.text(
            "UPDATE importacoes SET linhas_novas = ("
            "SELECT COUNT(*) FROM lancamentos WHERE lancamentos.importacao_id = importacoes.id"
            ")"
        )
    )
    op.add_column("lancamentos", sa.Column("conta_id", sa.Integer(), nullable=True))
    op.add_column("lancamentos", sa.Column("categoria_id", sa.Integer(), nullable=True))
    op.add_column("lancamentos", sa.Column("origem", sa.String(length=12), server_default="importado", nullable=False))
    op.add_column("lancamentos", sa.Column("assinatura", sa.String(length=64), nullable=True))
    op.add_column("lancamentos", sa.Column("ordem_repeticao", sa.Integer(), nullable=True))
    op.add_column("lancamentos", sa.Column("ordem_extrato", sa.Integer(), nullable=True))
    op.alter_column(
        "lancamentos",
        "documento",
        existing_type=sa.String(length=60),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    op.alter_column("lancamentos", "importacao_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("saldos_mensais", sa.Column("conta_id", sa.Integer(), nullable=True))
    op.add_column(
        "saldos_mensais",
        sa.Column("origem_valor", sa.String(length=20), server_default="extrato", nullable=False),
    )
    op.alter_column("saldos_mensais", "importacao_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column(
        "saldos_mensais",
        "saldo_informado_centavos",
        existing_type=sa.BigInteger(),
        nullable=True,
    )
    for codigo, nome in ((104, "104 - Caixa"), (136, "136 - Unicred"), (341, "341 - Itaú")):
        bind.execute(
            sa.text("UPDATE saldos_mensais SET conta_id = :codigo WHERE lower(trim(banco)) = lower(:nome)"),
            {"codigo": codigo, "nome": nome},
        )
        bind.execute(
            sa.text("UPDATE lancamentos SET conta_id = :codigo WHERE lower(trim(banco)) = lower(:nome)"),
            {"codigo": codigo, "nome": nome},
        )
    if bind.scalar(sa.text("SELECT COUNT(*) FROM lancamentos WHERE conta_id IS NULL")):
        raise RuntimeError("Existem lançamentos com banco fora das três contas fixas; corrija-os antes da migração.")
    if bind.scalar(sa.text("SELECT COUNT(*) FROM saldos_mensais WHERE conta_id IS NULL")):
        raise RuntimeError("Existem saldos mensais com banco fora das três contas fixas; corrija-os antes da migração.")
    if bind.scalar(
        sa.text(
            "SELECT COUNT(*) FROM ("
            "SELECT competencia, conta_id FROM saldos_mensais "
            "GROUP BY competencia, conta_id HAVING COUNT(*) > 1"
            ") duplicados"
        )
    ):
        raise RuntimeError("Há saldos mensais duplicados para a mesma conta; resolva-os antes da migração.")
    for codigo, nome in ((104, "104 - Caixa"), (136, "136 - Unicred"), (341, "341 - Itaú")):
        bind.execute(
            sa.text("UPDATE saldos_mensais SET banco = :nome WHERE conta_id = :codigo"),
            {"codigo": codigo, "nome": nome},
        )
    op.alter_column("lancamentos", "conta_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("saldos_mensais", "conta_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key("fk_saldos_mensais_conta_id_contas", "saldos_mensais", "contas", ["conta_id"], ["id"])
    op.create_index("ix_saldos_mensais_conta_id", "saldos_mensais", ["conta_id"], unique=False)

    categorias = bind.execute(sa.text("SELECT DISTINCT categoria FROM lancamentos ORDER BY categoria")).scalars().all()
    categorias_por_chave = {}
    for nome in categorias:
        categorias_por_chave.setdefault(nome.casefold(), nome)
    categorias_por_chave.setdefault("aplicação financeira".casefold(), "Aplicação Financeira")
    for nome in sorted(categorias_por_chave.values(), key=str.casefold):
        bind.execute(
            sa.text("INSERT INTO categorias (nome, sistema) VALUES (:nome, :sistema)"),
            {"nome": nome, "sistema": nome.casefold() == "aplicação financeira".casefold()},
        )

    for nome in categorias_por_chave.values():
        bind.execute(
            sa.text(
                "UPDATE lancamentos SET categoria_id = c.id "
                "FROM categorias c WHERE lower(lancamentos.categoria) = lower(c.nome) "
                "AND lower(c.nome) = lower(:nome)"
            ),
            {"nome": nome},
        )

    rows = bind.execute(
        sa.text(
            "SELECT id, banco, data, descricao, valor_centavos, documento "
            "FROM lancamentos WHERE importacao_id IS NOT NULL ORDER BY id"
        )
    ).mappings()
    repeticoes = defaultdict(int)
    for row in rows:
        assinatura = _assinatura(row["banco"], row["data"], row["descricao"], row["valor_centavos"], row["documento"])
        repeticoes[assinatura] += 1
        bind.execute(
            sa.text(
                "UPDATE lancamentos SET assinatura = :assinatura, ordem_repeticao = :ordem, ordem_extrato = :ordem_extrato "
                "WHERE id = :id"
            ),
            {
                "assinatura": assinatura,
                "ordem": repeticoes[assinatura],
                "ordem_extrato": row["id"],
                "id": row["id"],
            },
        )

    op.alter_column("lancamentos", "categoria_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key("fk_lancamentos_conta_id_contas", "lancamentos", "contas", ["conta_id"], ["id"])
    op.create_foreign_key("fk_lancamentos_categoria_id_categorias", "lancamentos", "categorias", ["categoria_id"], ["id"])
    op.create_unique_constraint(
        "uq_lancamento_assinatura_repeticao", "lancamentos", ["assinatura", "ordem_repeticao"]
    )
    op.create_index("ix_lancamentos_conta_id", "lancamentos", ["conta_id"], unique=False)
    op.create_index("ix_lancamentos_categoria_id", "lancamentos", ["categoria_id"], unique=False)
    op.create_index("ix_lancamentos_assinatura", "lancamentos", ["assinatura"], unique=False)

    empresas = bind.execute(sa.text("SELECT id, nome, cnpj FROM empresas ORDER BY id")).mappings().all()
    empresas_por_nome = defaultdict(list)
    for empresa in empresas:
        empresas_por_nome[empresa["nome"].casefold()].append(empresa)
    for grupo in empresas_por_nome.values():
        if len(grupo) < 2:
            continue
        principal = grupo[0]
        cnpj_principal = principal["cnpj"]
        for duplicada in grupo[1:]:
            cnpj_duplicado = duplicada["cnpj"]
            if cnpj_principal and cnpj_duplicado and cnpj_principal != cnpj_duplicado:
                raise RuntimeError(
                    f'Empresas com o nome "{principal["nome"]}" têm CNPJs diferentes; resolva antes da migração.'
                )
            if not cnpj_principal and cnpj_duplicado:
                bind.execute(
                    sa.text("UPDATE empresas SET cnpj = :cnpj WHERE id = :id"),
                    {"cnpj": cnpj_duplicado, "id": principal["id"]},
                )
                cnpj_principal = cnpj_duplicado
            bind.execute(
                sa.text("UPDATE lancamentos SET empresa_id = :principal WHERE empresa_id = :duplicada"),
                {"principal": principal["id"], "duplicada": duplicada["id"]},
            )
            bind.execute(sa.text("DELETE FROM empresas WHERE id = :id"), {"id": duplicada["id"]})

    op.create_index("uq_empresas_nome_lower", "empresas", [sa.text("lower(nome)")], unique=True)
    op.create_index("uq_categorias_nome_lower", "categorias", [sa.text("lower(nome)")], unique=True)

    op.create_table(
        "titulos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=10), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("forma", sa.String(length=10), nullable=False),
        sa.Column("numero", sa.String(length=80), nullable=False),
        sa.Column("descricao", sa.String(length=255), server_default="", nullable=False),
        sa.Column("valor_centavos", sa.BigInteger(), nullable=False),
        sa.Column("vencimento", sa.Date(), nullable=False),
        sa.Column("pago_em", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["empresa_id"], ["empresas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_titulos_tipo", "titulos", ["tipo"], unique=False)
    op.create_index("ix_titulos_empresa_id", "titulos", ["empresa_id"], unique=False)
    op.create_index("ix_titulos_vencimento", "titulos", ["vencimento"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_titulos_vencimento", table_name="titulos")
    op.drop_index("ix_titulos_empresa_id", table_name="titulos")
    op.drop_index("ix_titulos_tipo", table_name="titulos")
    op.drop_table("titulos")
    op.drop_index("ix_saldos_mensais_conta_id", table_name="saldos_mensais")
    op.drop_constraint("fk_saldos_mensais_conta_id_contas", "saldos_mensais", type_="foreignkey")
    op.alter_column(
        "saldos_mensais",
        "saldo_informado_centavos",
        existing_type=sa.BigInteger(),
        nullable=False,
    )
    op.alter_column("saldos_mensais", "importacao_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("saldos_mensais", "origem_valor")
    op.drop_column("saldos_mensais", "conta_id")
    op.drop_index("uq_categorias_nome_lower", table_name="categorias")
    op.drop_index("uq_empresas_nome_lower", table_name="empresas")
    op.drop_index("ix_lancamentos_assinatura", table_name="lancamentos")
    op.drop_index("ix_lancamentos_categoria_id", table_name="lancamentos")
    op.drop_index("ix_lancamentos_conta_id", table_name="lancamentos")
    op.drop_constraint("uq_lancamento_assinatura_repeticao", "lancamentos", type_="unique")
    op.drop_constraint("fk_lancamentos_categoria_id_categorias", "lancamentos", type_="foreignkey")
    op.drop_constraint("fk_lancamentos_conta_id_contas", "lancamentos", type_="foreignkey")
    op.alter_column("lancamentos", "categoria_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("lancamentos", "importacao_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("lancamentos", "ordem_extrato")
    op.drop_column("lancamentos", "ordem_repeticao")
    op.drop_column("lancamentos", "assinatura")
    op.drop_column("lancamentos", "origem")
    op.drop_column("lancamentos", "categoria_id")
    op.drop_column("lancamentos", "conta_id")
    op.alter_column(
        "lancamentos",
        "documento",
        existing_type=sa.String(length=255),
        type_=sa.String(length=60),
        existing_nullable=True,
    )
    op.drop_column("importacoes", "linhas_iguais")
    op.drop_column("importacoes", "linhas_atualizadas")
    op.drop_column("importacoes", "linhas_novas")
    op.drop_column("empresas", "tipo")
    op.drop_table("categorias")
    op.drop_table("contas")
