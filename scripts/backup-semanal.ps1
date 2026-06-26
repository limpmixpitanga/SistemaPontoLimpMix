param(
  [string]$Projeto = "D:\CodexGPT\Sistema PontoLimpMix",
  [string]$DestinoDrive = "D:\Documents\BACKUP Meu Drive\SistemaPontoLimpMix"
)

$ErrorActionPreference = "Stop"

$dataDir = Join-Path $Projeto "data"
if (-not (Test-Path $dataDir)) {
  throw "Pasta data nao encontrada: $dataDir"
}

New-Item -ItemType Directory -Force -Path $DestinoDrive | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupName = "backup_ponto_limpMix_$stamp.zip"
$backupPath = Join-Path $DestinoDrive $backupName

Compress-Archive -Path (Join-Path $dataDir "*") -DestinationPath $backupPath -Force

$manifest = Join-Path $DestinoDrive "ultimo_backup.txt"
@(
  "Backup: $backupName"
  "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  "Origem: $dataDir"
  "Destino: $DestinoDrive"
) | Set-Content -Path $manifest -Encoding UTF8

Get-ChildItem -Path $DestinoDrive -Filter "backup_ponto_limpMix_*.zip" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 12 |
  Remove-Item -Force

Write-Host "Backup criado em: $backupPath"

