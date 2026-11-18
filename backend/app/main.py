from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import auth, categorias, contas, dashboard, empresas, importacoes, lancamentos, saldos, titulos, usuarios
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
app.include_router(contas.router)
app.include_router(categorias.router)
app.include_router(importacoes.router)
app.include_router(lancamentos.router)
app.include_router(empresas.router)
app.include_router(titulos.router)
app.include_router(saldos.router)
app.include_router(dashboard.router)


@app.exception_handler(RequestValidationError)
async def erro_validacao(request: Request, exc: RequestValidationError):
    partes = []
    for erro in exc.errors():
        campo = ".".join(str(item) for item in erro["loc"] if item not in ("body", "query", "path"))
        partes.append(f"{campo}: {erro['msg']}" if campo else erro["msg"])
    return JSONResponse(status_code=422, content={"detail": "Erro de validação: " + "; ".join(partes)})


@app.exception_handler(HTTPException)
async def erro_http(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=exc.headers)

diretorio_atualizacoes = Path(__file__).resolve().parent.parent / "atualizacoes"
diretorio_atualizacoes.mkdir(parents=True, exist_ok=True)
app.mount("/atualizacoes", StaticFiles(directory=diretorio_atualizacoes), name="atualizacoes")


@app.get("/api/health")
def health():
    return {"ok": True}
