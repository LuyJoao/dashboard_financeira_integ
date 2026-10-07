# Servidor na rede interna (PostgreSQL + API em uma máquina da empresa)

```
App desktop (PCs da empresa) ──HTTP──► Máquina servidora: API (porta 8000) ──► PostgreSQL (só local)
```

## 0. A máquina servidora
- PC ou servidor que fique **ligado** nos horários de uso. Desative suspensão/hibernação.
- **IP fixo**: reserve o IP dessa máquina no roteador (reserva de DHCP). O app vai apontar para ele.

## 1. PostgreSQL
1. Instale o PostgreSQL (postgresql.org/download). Mantenha `listen_addresses = 'localhost'` (padrão):
   o banco **não** fica acessível pela rede, só a API fala com ele.
2. Crie usuário e banco (no `psql`, como `postgres`). Use uma senha longa, só letras e números:
   ```sql
   CREATE USER app WITH PASSWORD 'SENHA_LONGA_AQUI';
   CREATE DATABASE pagamentos OWNER app;
   ```

## 2. API
1. Copie a pasta do projeto para a máquina (ex.: `C:\pagamentos` ou `/opt/pagamentos`).
2. Em `backend`: criar o ambiente e instalar as dependências (Python 3.11+):
   ```
   python -m venv .venv
   .venv\Scripts\activate          # Linux: source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. `copy .env.example .env` (Linux: `cp`) e edite: `DATABASE_URL` (com a senha do passo 1) e
   `SECRET_KEY` (gere com `python -c "import secrets; print(secrets.token_urlsafe(48))"`).
4. Crie as tabelas e o primeiro administrador:
   `python -m app.seed admin@empresa.com "Administrador" SENHA_FORTE`
5. Teste: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## 3. Liberar a porta 8000 (apenas rede local)
- Windows (PowerShell como administrador):
  `netsh advfirewall firewall add rule name="Pagamentos API" dir=in action=allow protocol=TCP localport=8000 profile=private`
- Linux: `sudo ufw allow 8000/tcp`

Em **outro computador** da rede, abra `http://IP_DO_SERVIDOR:8000/api/health`. Deve mostrar `{"ok":true}`.
**Não** faça redirecionamento de portas (port forwarding) no roteador e **não** libere a 5432.

## 4. Iniciar automaticamente com a máquina
- Windows (PowerShell como administrador; ajuste o caminho):
  ```
  schtasks /create /tn "PagamentosAPI" /tr "C:\pagamentos\deploy\windows\iniciar-api.bat" /sc onstart /ru SYSTEM
  ```
- Linux: copie `deploy/linux/pagamentos-api.service` para `/etc/systemd/system/`, depois
  `sudo systemctl enable --now pagamentos-api`.

## 5. Backup (obrigatório)
Edite `$PgBin` e `$Dest` em `windows\backup.ps1` (Linux: `DEST` em `linux/backup.sh`). Agende todo dia:
- Windows:
  ```
  schtasks /create /tn "PagamentosBackup" /tr "powershell -ExecutionPolicy Bypass -File C:\pagamentos\deploy\windows\backup.ps1" /sc daily /st 22:00 /ru SYSTEM
  ```
- Linux (`crontab -e`): `0 22 * * * /opt/pagamentos/deploy/linux/backup.sh`

Guarde os backups **em outro disco ou outra máquina** (um backup no mesmo disco não protege contra falha do disco).
**Teste a restauração** pelo menos uma vez:
`pg_restore -h localhost -U app -d pagamentos --clean --if-exists ARQUIVO.dump`

## 6. Apontar o app para o servidor
Em `desktop/.env`: `VITE_API_URL=http://IP_DO_SERVIDOR:8000`, depois `npm run electron:build` e
distribua o instalador de `desktop/release`. Se o IP mudar, é preciso gerar o instalador de novo.

## Segurança
- Na rede interna a API usa HTTP (sem criptografia): a senha e o token trafegam em texto na rede local.
  Aceitável para uma rede interna pequena e confiável; para endurecer, coloque HTTPS na frente (ex.: Caddy).
- Use senhas fortes, troque a `SECRET_KEY` e mantenha o sistema operacional atualizado.
- Acesso remoto: use uma VPN. Não exponha a API diretamente na internet.
