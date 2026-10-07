@echo off
rem Inicia a API na rede interna (porta 8000). Rode da pasta deploy\windows.
cd /d "%~dp0\..\..\backend"
call .venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
