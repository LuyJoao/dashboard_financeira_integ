"""para criar o primeiro administrador: python -m app.seed EMAIL "NOME" SENHA"""
import sys

from sqlalchemy import select

from . import models
from .core.security import hash_senha
from .db import SessionLocal

def main(email: str, nome: str, senha: str) -> None:
    with SessionLocal() as db:
        if db.scalar(select(models.Usuario).where(models.Usuario.email == email.lower())):
            print("Esse e-mail já existe.")
            return
        db.add(models.Usuario(nome=nome, email=email.lower(), senha_hash=hash_senha(senha), role="admin"))
        db.commit()
        print("Administrador criado.")


if __name__ == "__main__":
    main(*sys.argv[1:4])
