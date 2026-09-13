# Upload the whole local project, respecting .gitignore.
param([switch]$CheckOnly, [string]$PythonExecutable = '')
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
    # Build customer inventory from private local data before uploading.
    # Never upload data/ itself, and never publish an empty snapshot on missing data.
    if (!(Test-Path "$source\data\parts.json" -PathType Leaf)) {
        throw "Inventory source missing: $source\data\parts.json. Run this on the PC holding the actual inventory."
    }
    if (!(Test-Path "$source\publish_pages.py" -PathType Leaf)) {
        throw 'publish_pages.py is missing. Update the program first.'
    }
    $pythonPrefix = @()
    if ($PythonExecutable) {
        $pythonCommand = (Get-Command $PythonExecutable -ErrorAction Stop).Source
    } elseif (Test-Path "$source\.venv\Scripts\python.exe") {
        $pythonCommand = "$source\.venv\Scripts\python.exe"
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCommand = (Get-Command py).Source
        $pythonPrefix = @('-3')
    } else {
        $pythonCommand = (Get-Command python -ErrorAction Stop).Source
    }
    # Generate inside an isolated snapshot; local inventory and docs stay unchanged.
    $publishCopy = Join-Path ([IO.Path]::GetTempPath()) ('OnlineShopExport-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $publishCopy | Out-Null
    Copy-Item -LiteralPath "$source\publish_pages.py" -Destination $publishCopy
    foreach ($localFolder in @('data','docs')) {
        $folderPath = Join-Path $source $localFolder
        if (Test-Path -LiteralPath $folderPath) {
            $entries = @(Get-Item -LiteralPath $folderPath) + @(Get-ChildItem -LiteralPath $folderPath -Recurse -Force)
            if ($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
                throw "Links are not allowed in $localFolder"
            }
            Copy-Item -LiteralPath $folderPath -Destination $publishCopy -Recurse -Force
        }
    }
    & $pythonCommand @pythonPrefix (Join-Path $publishCopy 'publish_pages.py')
    if ($LASTEXITCODE -ne 0) { throw 'Inventory conversion failed. Nothing uploaded.' }
    $exportJson = [IO.File]::ReadAllText((Join-Path $publishCopy 'docs\products.json'))
    $exported = @($exportJson | ConvertFrom-Json)
    if (!$CheckOnly -and $exported.Count -eq 0) {
        if ((Read-Host 'No public products. Type EMPTY to publish empty inventory') -cne 'EMPTY') {
            Write-Host 'Cancelled. Public inventory unchanged.'
            return
        }
    }
    # Overlay all local project files. Remote-only files are retained.
    Copy-Project $source $job
    $docsTarget = Join-Path $job 'docs'
    if (Test-Path -LiteralPath $docsTarget) {
        $resolvedDocs = (Resolve-Path -LiteralPath $docsTarget).Path
        if ($resolvedDocs -ine [IO.Path]::GetFullPath((Join-Path $job 'docs'))) { throw 'Unexpected export path.' }
        Remove-Item -LiteralPath $resolvedDocs -Recurse -Force
    }
    Copy-Item -LiteralPath (Join-Path $publishCopy 'docs') -Destination $docsTarget -Recurse -Force
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
