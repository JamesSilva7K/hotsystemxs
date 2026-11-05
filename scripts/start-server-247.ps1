# =====================================================================
# HOT SYSTEM 2.0 - SCRIPT DE EXECUÇÃO 24/7 COM SUPERVISOR E AUTO-HEALING
# =====================================================================
# Este script mantém o servidor e todos os Bots do Telegram rodando 24 horas por dia.
# Se o processo cair por oscilação de rede ou falta de memória, ele reinicia em 2 segundos.

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "HOT SYSTEM - Servidor & Bots Telegram 24/7 Ativos"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " 🚀 HOT SYSTEM - INICIANDO MOTOR 24/7 DE BOTS TELEGRAM" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Diretório do Projeto: $projectRoot" -ForegroundColor Gray

# Cria diretório de logs se não existir
$logDir = Join-Path $projectRoot "data"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "server-247.log"

# Compila o projeto se o bundle do servidor não existir
$serverBundle = Join-Path $projectRoot "dist-server\server.js"
if (!(Test-Path $serverBundle)) {
    Write-Host "[Build] Compilando Hot System para produção..." -ForegroundColor Cyan
    npm run build
}

$restartCount = 0

while ($true) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$now] Iniciando processo do servidor (Ciclo #$($restartCount + 1))..." -ForegroundColor Green
    "[$now] === INICIANDO SERVIDOR HOT SYSTEM ===" | Out-File -FilePath $logFile -Append -Encoding utf8

    try {
        # Executa o servidor em Node.js com porta e host configurados
        node dist-server/server.js 2>&1 | Tee-Object -FilePath $logFile -Append
    }
    catch {
        Write-Host "[$now] Exceção capturada: $_" -ForegroundColor Red
        "[$now] ERRO: $_" | Out-File -FilePath $logFile -Append -Encoding utf8
    }

    $restartCount++
    $failTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$failTime] ⚠️ Servidor encerrou. Auto-healing em ação: reiniciando em 2 segundos..." -ForegroundColor Yellow
    "[$failTime] AVISO: Processo encerrou. Reiniciando em 2s..." | Out-File -FilePath $logFile -Append -Encoding utf8
    Start-Sleep -Seconds 2
}
