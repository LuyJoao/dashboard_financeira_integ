# Pagamentos — base do projeto

FastAPI (Python) + PostgreSQL no back-end; React + TypeScript + Electron no desktop.

## Arquitetura (importante)

```
App desktop (cada usuário)  ──HTTPS──►  API FastAPI (servidor)  ──►  PostgreSQL (servidor)
```

Quem usa o app **não instala PostgreSQL nem Python**: só o instalador do app desktop.
O banco e a API ficam em um servidor central, e é lá que todos compartilham os mesmos dados.
Em desenvolvimento, você precisa do PostgreSQL na sua máquina (ou em um serviço online).

## 1. PostgreSQL para desenvolvimento (escolha uma opção)

**A) Instalar na máquina** — baixe em https://www.postgresql.org/download/ (Windows/macOS),
ou `sudo apt install postgresql` (Ubuntu). Depois crie o usuário e o banco:

```sql
-- no psql (como usuário postgres):
CREATE USER app WITH PASSWORD 'app';
CREATE DATABASE pagamentos OWNER app;
```

**B) Serviço online gratuito** (Neon, Supabase): crie o banco no site e copie a
connection string para `DATABASE_URL`, trocando o início por `postgresql+psycopg://`.

## 2. Rodar o back-end

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # ajuste DATABASE_URL e troque SECRET_KEY
python -m app.seed admin@empresa.com "Administrador" SenhaForte123   # cria tabelas e 1º admin
uvicorn app.main:app --reload
```

Documentação interativa: http://localhost:8000/docs
O código do "esqueci a senha" aparece no console da API (e-mail real: `app/services/email.py`).

## 3. Rodar o desktop

```bash
cd desktop
npm install
cp .env.example .env
npm run electron:dev      # abre o app Electron
npm run dev               # ou só no navegador: http://localhost:5173
npm run electron:build    # gera o instalador em desktop/release
```

Em produção, aponte `VITE_API_URL` (em `desktop/.env`) para a URL HTTPS da API antes do build.

## O que já está pronto

- Login (JWT), `/me`, esqueci/redefinir senha (código de uso único, expira em 30 min)
- Cadastro de usuários só por administrador (`/api/usuarios`, tela "Usuários")
- Navbar com rotas, iniciais + nome do usuário logado e botão Sair
- Rotas protegidas (e rota exclusiva de admin)
- Modelos: usuários, reset de senha, empresas, importações, pagamentos (valor em centavos)

## Próximos passos

1. Alembic no lugar do `create_all`
2. Importação do Excel (`pandas` + `openpyxl`), com prévia e upsert pela chave (empresa, documento, competência)
3. Empresas, pagamentos e filtros por categoria
4. Dashboard (endpoints agregados + Recharts)
5. Token no armazenamento seguro do Electron (`safeStorage`) e auto-update (`electron-updater`)

## Servidor na rede interna

Passo a passo para hospedar API + PostgreSQL em uma máquina da empresa (início automático,
firewall e backup diário): veja `deploy/README.md`.
