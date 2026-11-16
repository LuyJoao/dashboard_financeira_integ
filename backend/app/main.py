from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/api/health")
def health():
    return {"ok": True}
