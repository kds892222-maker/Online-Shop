# Upload the whole local project, respecting .gitignore.
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$source = 'C:\Online-Shop'
$repo = 'https://github.com/kds892222-maker/Online-Shop.git'
$mutex = [Threading.Mutex]::new($false, 'Local\OnlineShopProjectPublisher')
$locked = $false
$job = $null

function Copy-Project([string]$from, [string]$to) {
    foreach ($item in Get-ChildItem -LiteralPath $from -Force) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Links are not supported: $($item.FullName)"
        }
        if ($item.Name -in @('.git','data','.venv','venv','__pycache__') -or
            $item.Name -like '.env*' -or $item.Name -like 'pages-*' -or
            $item.Name -match '\.py[cod]$') { continue }
        $dest = Join-Path $to $item.Name
        if ($item.PSIsContainer) {
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
            Copy-Project $item.FullName $dest
        } else {
            Copy-Item -LiteralPath $item.FullName -Destination $dest -Force
        }
    }
}

try {
    try { $locked = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Another upload is already running.' }
    Get-Command git -ErrorAction Stop | Out-Null
    if (!(Test-Path "$source\app.py" -PathType Leaf)) { throw "Project missing: $source" }
    if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Source folder must not be a link.'
    }
    $job = Join-Path ([IO.Path]::GetTempPath()) ('OnlineShopSave-' + [guid]::NewGuid().ToString('N'))
    git -c http.sslBackend=openssl clone --depth 1 --branch main --single-branch $repo $job
    if ($LASTEXITCODE -ne 0) { throw 'GitHub download/authentication failed.' }
    if (Get-ChildItem -LiteralPath $job -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
        throw 'Remote checkout contains links. Upload stopped.'
    }
    # Overlay all local project files. Remote-only files are retained.
    Copy-Project $source $job
    git -C $job add -A
    if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare upload.' }
    $paths = @(git -C $job diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect upload.' }
    foreach ($path in $paths) {
        if ($path -match '(^|/)(data|\.venv|venv|__pycache__)(/|$)|(^|/)\.env[^/]*$|\.py[cod]$') {
            throw "Private/local file detected. Upload stopped: $path"
        }
    }
    git -C $job diff --cached --stat
    if ($CheckOnly) {
        Write-Host 'Check complete. Nothing was uploaded.' -ForegroundColor Green
        return
    }
    if (!$paths.Count) {
        Write-Host 'Already up to date.' -ForegroundColor Green
        return
    }
    git -C $job -c user.name=kds892222-maker -c user.email=kds892222-maker@users.noreply.github.com commit -m 'Save complete Online-Shop project'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }
    git -C $job -c http.sslBackend=openssl push origin HEAD:main
    if ($LASTEXITCODE -ne 0) { throw 'Upload failed or remote changed. Run again; no force push was used.' }
    Write-Host 'Project uploaded successfully.' -ForegroundColor Green
    Write-Host 'https://github.com/kds892222-maker/Online-Shop'
}
catch {
    Write-Host "Stopped: $_" -ForegroundColor Red
    if ($CheckOnly) { throw }
}
finally {
    if ($job) { Write-Host "Working copy retained: $job" }
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
    if (!$CheckOnly) { Read-Host 'Press Enter to close' | Out-Null }
}
