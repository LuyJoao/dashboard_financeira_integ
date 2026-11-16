"""Configuração dos testes.

SEGURANÇA: os testes apagam as tabelas a cada teste, então rodam em um banco SEPARADO (nome termina em
"_test"), nunca no de desenvolvimento. O banco é derivado do DATABASE_URL do .env
(pagamentos -> pagamentos_test) ou vem de TEST_DATABASE_URL.
"""
import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

BACKEND = Path(__file__).resolve().parents[1]


def _url_de_teste() -> str:
    if os.environ.get("TEST_DATABASE_URL"):
        return os.environ["TEST_DATABASE_URL"]
    from dotenv import dotenv_values

    base = (
        os.environ.get("DATABASE_URL")
        or dotenv_values(BACKEND / ".env").get("DATABASE_URL")
        or "postgresql+psycopg://app:app@localhost:5432/pagamentos"
    )
    u = make_url(base)
    nome = u.database if u.database.endswith("_test") else f"{u.database}_test"
    return u.set(database=nome).render_as_string(hide_password=False)


TEST_URL = _url_de_teste()
# Precisa vir ANTES de importar "app": as configurações são lidas na importação.
os.environ["DATABASE_URL"] = TEST_URL
os.environ["SMTP_HOST"] = ""  # os testes nunca enviam e-mail de verdade

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import previas  # noqa: E402

from .helpers import SENHA, criar_usuario, login_headers  # noqa: E402,F401

# O argon2 é lento de propósito (~0,35 s por hash); com centenas de testes criando usuários e fazendo login isso
# multiplicaria o tempo da suíte. Aqui usamos parâmetros baratos: a lógica (hash, verificação, troca de senha)
# testada é a mesma, só o custo do hash muda.
from argon2 import PasswordHasher  # noqa: E402

from app.core import security  # noqa: E402

security._ph = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)


@pytest.fixture(scope="session", autouse=True)
def _banco_de_teste():
    url = make_url(TEST_URL)
    if not url.database.endswith("_test"):
        pytest.exit(f"Recusando rodar testes no banco '{url.database}': o nome precisa terminar em _test.", returncode=2)
    adm = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with adm.connect() as c:
            if not c.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}):
                c.execute(text(f'CREATE DATABASE "{url.database}"'))
    except Exception as e:
        pytest.exit(
            f"Não consegui acessar/criar o banco de testes '{url.database}' ({type(e).__name__}).\n"
            f"Crie-o uma vez com um usuário administrador do PostgreSQL:\n"
            f'  CREATE DATABASE {url.database} OWNER {url.username};\n'
            f"ou defina TEST_DATABASE_URL.",
            returncode=2,
        )
    finally:
        adm.dispose()

    # Esquema criado pelas migrations (assim elas também são testadas).
    from alembic import command
    from alembic.config import Config

    Base.metadata.drop_all(engine)
    with engine.begin() as c:
        c.execute(text("DROP TABLE IF EXISTS alembic_version"))
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    command.upgrade(cfg, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _estado_limpo(_banco_de_teste, monkeypatch):
    with engine.begin() as c:
        c.execute(text("TRUNCATE " + ", ".join(Base.metadata.tables) + " RESTART IDENTITY CASCADE"))
    previas._previas.clear()
    monkeypatch.setattr(settings, "reset_intervalo_segundos", 0)  # os testes de limite ligam de novo
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin():
    return criar_usuario("Admin", "admin@x.com", "admin")


@pytest.fixture
def usuario():
    return criar_usuario("Ana", "ana@x.com", "user")


@pytest.fixture
def h_admin(client, admin):
    return login_headers(client, admin.email)


@pytest.fixture
def h_user(client, usuario):
    return login_headers(client, usuario.email)
