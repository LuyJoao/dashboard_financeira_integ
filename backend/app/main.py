from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import auth, dashboard, empresas, importacoes, lancamentos, usuarios
from .core.config import settings

# As tabelas agora são criadas/alteradas via Alembic (ver backend/alembic/),
# não mais por Base.metadata.create_all(). Rode "alembic upgrade head" antes
# de subir a API (o README e o seed.py também dependem disso).

app = FastAPI(title="Pagamentos API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(importacoes.router)
app.include_router(lancamentos.router)
app.include_router(empresas.router)
app.include_router(dashboard.router)

diretorio_atualizacoes = Path(__file__).resolve().parent.parent / "atualizacoes"
diretorio_atualizacoes.mkdir(parents=True, exist_ok=True)
app.mount("/atualizacoes", StaticFiles(directory=diretorio_atualizacoes), name="atualizacoes")


@app.get("/api/health")
def health():
    return {"ok": True}
