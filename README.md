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
alembic upgrade head                   # cria/atualiza as tabelas (ver backend/alembic/)
python -m app.seed admin@empresa.com "Administrador" SenhaForte123   # cria o 1º admin
uvicorn app.main:app --reload
```

Sempre que os models (`app/models.py`) mudarem, gere uma migration nova:

```bash
alembic revision --autogenerate -m "descrição da mudança"
alembic upgrade head
```

Confira o arquivo gerado em `alembic/versions/` antes de aplicar — o autogenerate não
detecta tudo (ex.: renomear uma coluna vira "dropar + criar outra").

Documentação interativa: http://localhost:8000/docs
Sem `SMTP_HOST` no `.env`, o código do "esqueci a senha" aparece no console da API (modo desenvolvimento).
Para enviar e-mail de verdade, preencha as variáveis `SMTP_*` (veja `backend/.env.example`) e confira com:

```bash
python -m app.testar_email seu@email.com
```

O comando mostra o erro completo se algo estiver errado (porta, usuário, senha, certificado).

## 3. Rodar o desktop

```bash
cd desktop
npm install
copy .env.example .env
npm run electron:dev      # abre o app Electron
npm run dev               # ou só no navegador: http://localhost:5173
npm run electron:build    # gera o instalador em backend/atualizacoes
```

Em produção, aponte `VITE_API_URL` (em `desktop/.env`) para a URL HTTPS da API antes do build.

## Testes (backend)

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

- **Banco separado:** os testes apagam as tabelas a cada teste, então rodam em `pagamentos_test` (o nome do banco do `.env` + `_test`),
  nunca no banco de desenvolvimento; se o nome não terminar em `_test` eles se recusam a rodar. Crie-o uma vez, com um usuário
  administrador do PostgreSQL: `CREATE DATABASE pagamentos_test OWNER app;` (ou defina `TEST_DATABASE_URL`).
- **O esquema vem das migrations** (`alembic upgrade head` roda sozinho no início), então as migrations também são testadas.
- **Sem dados reais:** `tests/planilhas.py` monta planilhas sintéticas no mesmo formato da planilha da INTEG; os valores esperados
  nos testes foram calculados à mão.
- **E-mail:** os testes sobem um servidor SMTP falso (`aiosmtpd`); nenhum e-mail de verdade é enviado. Os testes de TLS usam o `openssl`
  (se não existir, são pulados).
- Cobertura: login e senhas, usuários, importação (prévia, confirmação, substituição por mês, saldos), lançamentos, categorias,
  empresas, dashboard, envio de e-mail e a regra de que **toda rota exige login**: um teste avisa se alguém criar uma rota nova sem proteção.

## O que já está pronto

- Login (JWT), `/me`, esqueci/redefinir senha (código de uso único, expira em 30 min)
- Cadastro de usuários só por administrador (`/api/usuarios`, tela "Usuários")
- "Esqueci a senha" com e-mail real por SMTP (`app/services/email.py`): o envio roda em segundo plano, a resposta da API é sempre a
  mesma exista o e-mail ou não, há intervalo mínimo entre pedidos (`RESET_INTERVALO_SEGUNDOS`) e um código novo invalida os anteriores
- Edição de usuários (`PATCH /api/usuarios/{id}`: nome, e-mail, perfil e `ativo`; desativar derruba o acesso na hora e o administrador não
  consegue se desativar nem se rebaixar) e troca da própria senha (`POST /api/auth/trocar-senha`, devolve 400 se a senha atual estiver errada)
- Navbar com rotas, iniciais + nome do usuário logado e botão Sair
- Rotas protegidas (e rota exclusiva de admin)
- Modelos: usuários, reset de senha, empresas, importações, lançamentos (extrato bancário; valor em centavos)
- Testes automatizados (`backend/tests/`, pytest): 265 testes das rotas principais, em cerca de 20 segundos
- Alembic configurado (`backend/alembic/`), migration inicial cobrindo todas as tabelas
- Importação do Excel (aba `Base`): `POST /api/importacoes/previa`, `POST /api/importacoes/confirmar` e `GET /api/importacoes`.
  A prévia valida linha a linha e não grava; a confirmação **substitui os lançamentos dos meses presentes no arquivo**
  (reenviar o mesmo arquivo não duplica). A empresa é extraída da Observação ("Empresa X"). Para o desktop usar a API
  de verdade: `VITE_USE_MOCK=false` em `desktop/.env`.
  A aba `Saldos_Mensais` é opcional: se existir, lê só "Mês", "Banco", "Saldo Inicial" e "Saldo Final Informado" (o resto são fórmulas)
  e também substitui por mês.
- Dashboard: `GET /api/dashboard` no formato de `desktop/src/api/dashboard.ts` (meses, categorias e conciliação por conta/mês).
  Aplicações e resgates ficam separados de receitas e despesas; as regras de classificação estão em `backend/app/services/dashboard.py`.
- Consulta de lançamentos: `GET /api/lancamentos` (filtros banco, categoria, tipo, empresa, período e busca; ordenação e paginação;
  `totais` com Receitas, Despesas, Despesas (abs) e Total Movimentado (abs)), `GET /api/lancamentos/filtros` (opções dos selects)
  e `GET /api/lancamentos/categorias` (as 4 medidas por categoria, mesmas fórmulas da aba Categorias da planilha)
- Empresas: `GET /api/empresas` (busca, ordenação e paginação, com quantidade e total de lançamentos) e `GET /api/empresas/{id}` (detalhe com os lançamentos)

## Próximos passos

1. Token no armazenamento seguro do Electron (`safeStorage`) e auto-update (`electron-updater`)

## Servidor na rede interna

Passo a passo para hospedar API + PostgreSQL em uma máquina da empresa (início automático,
firewall e backup diário): veja `deploy/README.md`.
