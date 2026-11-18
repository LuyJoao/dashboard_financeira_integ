from app.core.security import hash_senha
from app.db import SessionLocal
from app.models import Usuario

SENHA = "TesteSeguro123"


def criar_usuario(nome: str, email: str, role: str = "user") -> Usuario:
    with SessionLocal() as db:
        usuario = Usuario(
            nome=nome,
            email=email.lower(),
            senha_hash=hash_senha(SENHA),
            role=role,
            ativo=True,
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        db.expunge(usuario)
        return usuario


def login_headers(client, email: str) -> dict[str, str]:
    resposta = client.post("/api/auth/login", json={"email": email, "senha": SENHA})
    assert resposta.status_code == 200, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}
