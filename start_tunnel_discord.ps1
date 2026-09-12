$ErrorActionPreference = "Stop"

$repo = Join-Path $env:USERPROFILE "Desktop\Inventory"
$python = "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$webhook = $env:DISCORD_WEBHOOK_URL
$logFile = Join-Path $env:TEMP "simsimpc-cloudflared.log"

if (-not (Test-Path $repo)) {
    throw "Inventory 폴더를 찾을 수 없습니다: $repo"
}

if (-not (Test-Path $python)) {
    throw "Python을 찾을 수 없습니다: $python"
}

if (-not (Test-Path $cloudflared)) {
    throw "cloudflared를 찾을 수 없습니다: $cloudflared"
}

if ([string]::IsNullOrWhiteSpace($webhook)) {
    throw "DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다."
}

if (Test-Path $logFile) {
    Remove-Item $logFile -Force
}

Write-Host "[1/3] FastAPI 서버 시작 중..."
$serverProcess = Start-Process `
    -FilePath $python `
    -ArgumentList "app.py" `
    -WorkingDirectory $repo `
    -PassThru

$serverReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        Invoke-WebRequest `
            -Uri "http://127.0.0.1:8000/customer" `
            -UseBasicParsing `
            -TimeoutSec 2 | Out-Null
        $serverReady = $true
        break
    }
    catch {
        if ($serverProcess.HasExited) {
            throw "FastAPI 서버가 실행 중 종료되었습니다."
        }
    }
}

if (-not $serverReady) {
    throw "30초 안에 FastAPI 서버가 열리지 않았습니다."
}

Write-Host "[2/3] Cloudflare Tunnel 시작 중..."
$tunnelProcess = Start-Process `
    -FilePath $cloudflared `
    -ArgumentList @(
        "tunnel",
        "--url", "http://127.0.0.1:8000",
        "--logfile", $logFile
    ) `
    -PassThru

$publicUrl = $null

for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1

    if ($tunnelProcess.HasExited) {
        throw "cloudflared가 실행 중 종료되었습니다."
    }

    if (Test-Path $logFile) {
        $log = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        $match = [regex]::Match(
            $log,
            'https://[a-z0-9-]+\.trycloudflare\.com',
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )

        if ($match.Success) {
            $publicUrl = $match.Value
            break
        }
    }
}

if (-not $publicUrl) {
    throw "Cloudflare 공개 주소를 찾지 못했습니다. 로그: $logFile"
}

$customerUrl = "$publicUrl/customer"

Write-Host "[3/3] Discord로 링크 전송 중..."

$payload = @{
    content = "🟢 심심PC 고객용 서버가 열렸습니다.`n$customerUrl"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri $webhook `
    -Method Post `
    -ContentType "application/json" `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) | Out-Null

Write-Host ""
Write-Host "완료"
Write-Host "고객용 외부 주소: $customerUrl"
Write-Host "관리자 로컬 주소: http://127.0.0.1:8000/"
Write-Host ""
Write-Host "이 PowerShell 창을 닫아도 시작된 프로세스는 계속 실행될 수 있습니다."
Write-Host "종료하려면 작업 관리자에서 python.exe와 cloudflared.exe를 종료하세요."
