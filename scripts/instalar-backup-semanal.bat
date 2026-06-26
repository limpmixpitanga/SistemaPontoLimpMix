@echo off
setlocal
net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Execute este arquivo como Administrador.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$script = Join-Path '%~dp0' 'backup-semanal.ps1'; $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File \"' + $script + '\"'); $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At 13:00; Register-ScheduledTask -TaskName 'LimpMix Backup Semanal Ponto' -Action $action -Trigger $trigger -Description 'Backup semanal dos dados do Sistema de Ponto LimpMix' -Force | Out-Null"

echo.
echo Tarefa criada: LimpMix Backup Semanal Ponto
echo Agenda: Sabado as 13:00
echo.
pause
