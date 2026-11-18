# Pagamentos — base do projeto

FastAPI (Python) + PostgreSQL no back-end; React + TypeScript + Electron no desktop.

## Arquitetura (importante)

```
App desktop (cada usuário)  ──HTTPS──►  API FastAPI (servidor)  ──►  PostgreSQL (servidor)
```

Quem usa o app **não instala PostgreSQL nem Python**: só o instalador do app desktop.
O banco e a API ficam em um servidor central, e é lá que todos compartilham os mesmos dados.
Em desenvolvimento, você precisa do PostgreSQL na sua máquina (ou em um serviço online).

## 1. PostgreSQL para desenvolvimento

**Instalar na máquina** — baixe em https://www.postgresql.org/download/ (Windows/macOS),
ou `sudo apt install postgresql` (Ubuntu). Depois crie o usuário e o banco:

```sql
-- no psql (como usuário postgres):
CREATE USER app WITH PASSWORD 'app';
CREATE DATABASE pagamentos OWNER app;
```

## 2. Rodar o back-end

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Linux: ativa a variavel de ambiente no Linux
.venv\Scripts\activate # Windows: ativa a variavel de ambiente no windows
pip install -r requirements.txt
copy .env.example .env                 # ajuste DATABASE_URL e troque SECRET_KEY
alembic upgrade head                 # cria/atualiza o schema e semeia contas/categoria do sistema
python -m app.seed admin@empresa.com "Administrador" SenhaForte123   # cria o 1º admin
uvicorn app.main:app --reload
```

Documentação interativa: http://localhost:8000/docs
O código do "esqueci a senha" aparece no console da API (e-mail real: `app/services/email.py`).

## 3. Rodar o desktop

```bash
cd desktop
npm install
copy .env.example .env
npm run electron:dev      # abre o app Electron
npm run dev               # ou só no navegador: http://localhost:5173
npm run electron:build    # gera o instalador em desktop/release
```

Em produção, aponte `VITE_API_URL` (em `desktop/.env`) para a URL HTTPS da API antes do build.

O schema é gerenciado exclusivamente pelo Alembic. A migração inicializa as três contas fixas e a categoria de sistema
"Aplicação Financeira"; o comando `app.seed` cria apenas o primeiro administrador.

## Servidor na rede interna

Passo a passo para hospedar API + PostgreSQL em uma máquina da empresa (início automático,
firewall e backup diário): veja `deploy/README.md`.
