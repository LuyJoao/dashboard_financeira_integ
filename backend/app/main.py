from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401  (registra as tabelas)
from .api import auth, usuarios
from .core.config import settings
from .db import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)  # desenvolvimento; trocar por Alembic
    yield


app = FastAPI(title="Pagamentos API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(usuarios.router)

diretorio_atualizacoes = Path(__file__).resolve().parent.parent / "atualizacoes"
diretorio_atualizacoes.mkdir(parents=True, exist_ok=True)
app.mount("/atualizacoes", StaticFiles(directory=diretorio_atualizacoes), name="atualizacoes")


@app.get("/api/health")
def health():
    return {"ok": True}
