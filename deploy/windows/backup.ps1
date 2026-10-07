# Backup diário do PostgreSQL. Lê a DATABASE_URL do backend\.env.
$ErrorActionPreference = "Stop"
$PgBin  = "C:\Program Files\PostgreSQL\16\bin"   # ajuste para a versão instalada
$Dest   = "D:\Backups\pagamentos"                # ideal: OUTRO disco ou pasta de rede
$Manter = 14                                     # quantos backups guardar

$envFile = Join-Path $PSScriptRoot "..\..\backend\.env"
$linha = Select-String -Path $envFile -Pattern '^DATABASE_URL=(.+)$' | Select-Object -First 1
$url = $linha.Matches[0].Groups[1].Value.Trim() -replace '\+psycopg', ''

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$arq = Join-Path $Dest ("pagamentos_{0:yyyyMMdd_HHmm}.dump" -f (Get-Date))
& "$PgBin\pg_dump.exe" -F c -f $arq --dbname=$url
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou" }

Get-ChildItem $Dest -Filter *.dump | Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Manter | Remove-Item
