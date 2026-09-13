# Windows PowerShell 5.1 / PowerShell 7
param(
    [string]$ShopPath = 'C:\Online-Shop',
    [string]$PythonExecutable = ''
)
$ErrorActionPreference = 'Stop'
$shop = [IO.Path]::GetFullPath($ShopPath).TrimEnd('\')
$repo = 'https://github.com/kds892222-maker/Online-Shop.git'
$mutex = [Threading.Mutex]::new($false, 'Local\OnlineShopSafeLauncher')
$locked = $false
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'

function Assert-SafeFolder {
    if ($shop -eq [IO.Path]::GetPathRoot($shop).TrimEnd('\') -or $shop -notmatch 'Online-Shop$') {
        throw 'Unexpected installation path.'
    }
    if (Test-Path -LiteralPath $shop) {
        $links = @(Get-Item -LiteralPath $shop -Force) + @(Get-ChildItem -LiteralPath $shop -Force -Recurse)
        if ($links | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
            throw 'Folder contains symbolic links or junctions. Automatic changes stopped.'
        }
    }
}

function Assert-ServerStopped {
    $listener = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if ($listener | Where-Object { $_.Port -eq 8000 }) {
        throw 'Port 8000 is already in use. Stop the existing server first.'
    }
}

function New-ShopBackup {
    Assert-SafeFolder
    Assert-ServerStopped
    $backup = 'C:\Online-Shop-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
    Copy-Item -LiteralPath $shop -Destination $backup -Recurse -Force
    Write-Host "Backup completed: $backup"
}

function Install-CleanShop {
    Assert-SafeFolder
    Assert-ServerStopped
    if (Test-Path -LiteralPath $shop) {
        Write-Host 'Existing inventory will NOT be restored. The old folder will be kept as a backup.' -ForegroundColor Yellow
        if ((Read-Host 'Type RESET Online-Shop to confirm') -cne 'RESET Online-Shop') {
            return $false
        }
    }
    # Download and check first. Never remove the working folder on download failure.
    $stage = 'C:\Online-Shop-download-' + [guid]::NewGuid().ToString('N')
    git -c http.sslBackend=openssl clone --branch main --single-branch $repo $stage | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Download failed. Existing installation unchanged. Temporary folder: $stage" }
    if (!(Test-Path "$stage\app.py")) { throw "Downloaded repository has no app.py: $stage" }
    Set-Location C:\
    if (Test-Path -LiteralPath $shop) {
        $backup = 'C:\Online-Shop-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
        Move-Item -LiteralPath $shop -Destination $backup
        try { Move-Item -LiteralPath $stage -Destination $shop }
        catch {
            Move-Item -LiteralPath $backup -Destination $shop
            throw
        }
        Write-Host "Old installation retained: $backup"
    } else {
        Move-Item -LiteralPath $stage -Destination $shop
    }
    return $true
}

function Update-Shop {
    $remote = git -C $shop remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $remote.TrimEnd('/') -notin @($repo, $repo.Replace('.git',''))) {
        throw 'Unexpected Git remote. Update stopped.'
    }
    $branch = git -C $shop branch --show-current
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Expected main branch. Update stopped.' }
    $changes = git -C $shop status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect local changes.' }
    if ($changes) {
        Write-Host 'Local changes found. Update skipped to preserve your files.' -ForegroundColor Yellow
        return
    }
    git -C $shop -c http.sslBackend=openssl fetch origin main | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Network/authentication error. Starting the existing version.' -ForegroundColor Yellow
        return
    }
    $current = git -C $shop rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read local revision.' }
    $latest = git -C $shop rev-parse refs/remotes/origin/main
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read remote revision.' }
    if ($current -eq $latest) { return }
    git -C $shop merge-base --is-ancestor HEAD refs/remotes/origin/main
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'History differs. Update skipped; no files overwritten.' -ForegroundColor Yellow
        return
    }
    New-ShopBackup
    git -C $shop merge --ff-only refs/remotes/origin/main | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'Update failed. Backup retained.' }
}

function Start-Shop {
    Set-Location -LiteralPath $shop
    $python = Join-Path $shop '.venv\Scripts\python.exe'
    if (!(Test-Path -LiteralPath $python)) {
        & $script:pythonCommand @script:pythonPrefix -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed.' }
    }
    & $python -c 'import importlib.util, sys; sys.exit(0 if all(importlib.util.find_spec(m) for m in ["fastapi", "uvicorn"]) else 1)'
    if ($LASTEXITCODE -ne 0) {
        & $python -m pip install --disable-pip-version-check --timeout 20 --retries 1 fastapi uvicorn
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. No inventory was removed.' }
    }
    Assert-ServerStopped
    Write-Host 'Server: http://127.0.0.1:8000   Stop: Ctrl+C'
    # Same FastAPI app, without development auto-reload.
    & $python -m uvicorn app:app --host 127.0.0.1 --port 8000
    if ($LASTEXITCODE -notin @(0,130,-1073741510,3221225786)) {
        throw "Server stopped with exit code $LASTEXITCODE"
    }
}

try {
    try { $locked = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'The launcher is already running.' }
    Get-Command git -ErrorAction Stop | Out-Null
    $script:pythonPrefix = @()
    if ($PythonExecutable) {
        $script:pythonCommand = (Get-Command $PythonExecutable -ErrorAction Stop).Source
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $script:pythonCommand = (Get-Command py).Source
        $script:pythonPrefix = @('-3')
    } elseif (Test-Path (Join-Path $shop '.venv\Scripts\python.exe')) {
        $script:pythonCommand = Join-Path $shop '.venv\Scripts\python.exe'
    } else {
        $script:pythonCommand = (Get-Command python -ErrorAction Stop).Source
    }
    & $script:pythonCommand @script:pythonPrefix -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)'
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.10+ required. Install Python or pass -PythonExecutable with its full path.' }
    Assert-SafeFolder
    Assert-ServerStopped
    if (!(Test-Path "$shop\.git")) {
        if (!(Install-CleanShop)) { return }
    } else {
        Update-Shop
    }
    try { Start-Shop }
    catch {
        Write-Host "Execution error: $_" -ForegroundColor Yellow
        if (Install-CleanShop) { Start-Shop }
    }
}
catch {
    Write-Host "Stopped safely: $_" -ForegroundColor Red
    Read-Host 'Press Enter to close' | Out-Null
}
finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
