# Save outside C:\Online-Shop. Run with PowerShell.
$ErrorActionPreference = 'Stop'
$source = 'C:\Online-Shop\docs'
$repo = 'https://github.com/kds892222-maker/Online-Shop.git'
$mutex = [Threading.Mutex]::new($false, 'Local\OnlineShopDocsPublisher')
$locked = $false
$job = $null

function Check-Docs([string]$folder) {
    foreach ($required in @('index.html', 'customer.js', 'style.css', 'products.json')) {
        if (!(Test-Path -LiteralPath (Join-Path $folder $required) -PathType Leaf)) {
            throw "Required file missing: $required"
        }
    }
    $items = @(Get-Item -LiteralPath $folder -Force) + @(Get-ChildItem -LiteralPath $folder -Recurse -Force)
    foreach ($item in $items) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Links are not allowed: $($item.FullName)"
        }
        if ($item.Name -eq '.git') { throw 'Nested Git folder is not allowed.' }
        if (!$item.PSIsContainer -and $item.Name -ne '.nojekyll' -and
            $item.Extension.ToLowerInvariant() -notin @('.html','.css','.js','.json','.jpg','.jpeg','.png','.webp','.svg','.ico')) {
            throw "Unexpected public file: $($item.Name)"
        }
    }
    $json = [IO.File]::ReadAllText((Join-Path $folder 'products.json'))
    if (!$json.TrimStart().StartsWith('[')) { throw 'products.json must contain an array.' }
    $products = @($json | ConvertFrom-Json)
    $fields = @('이름','종류','목표판매가','이미지','재고번호')
    foreach ($product in $products) {
        if ($null -eq $product) { throw 'Invalid product entry.' }
        foreach ($field in $product.PSObject.Properties.Name) {
            if ($field -notin $fields) { throw "Unexpected product field: $field" }
        }
        foreach ($field in $fields) {
            if ($field -notin $product.PSObject.Properties.Name) { throw "Missing product field: $field" }
        }
        $image = [string]$product.'이미지'
        if ($image -notmatch '^uploads/[a-f0-9]{64}\.(jpg|jpeg|png|webp)$') { throw 'Invalid product image path.' }
        $imageFile = Join-Path $folder $image
        if (!(Test-Path -LiteralPath $imageFile -PathType Leaf)) { throw "Missing product image: $image" }
        if ((Get-Item -LiteralPath $imageFile).Length -eq 0) { throw "Empty image: $image" }
    }
    return $products.Count
}

try {
    try { $locked = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Another upload is already running.' }
    Get-Command git -ErrorAction Stop | Out-Null
    if (!(Test-Path -LiteralPath $source -PathType Container)) { throw "Folder missing: $source" }
    $count = Check-Docs $source

    # Work on an isolated copy; never modify the original project.
    $job = Join-Path ([IO.Path]::GetTempPath()) ('OnlineShopPublish-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $job | Out-Null
    $snapshot = Join-Path $job 'snapshot'
    Copy-Item -LiteralPath $source -Destination $snapshot -Recurse -Force
    $count = Check-Docs $snapshot
    if ($count -eq 0) {
        if ((Read-Host 'No products. Type EMPTY to publish an empty inventory') -cne 'EMPTY') {
            Write-Host 'Cancelled. Public inventory unchanged.'
            return
        }
    }
    $checkout = Join-Path $job 'repository'
    git -c http.sslBackend=openssl clone --depth 1 --branch main --single-branch $repo $checkout
    if ($LASTEXITCODE -ne 0) { throw 'Download/authentication failed. Public inventory unchanged.' }

    $target = Join-Path $checkout 'docs'
    if (Test-Path -LiteralPath $target) {
        # Delete only docs inside this freshly created temporary checkout.
        $resolved = (Resolve-Path -LiteralPath $target).Path
        $expected = [IO.Path]::GetFullPath((Join-Path $checkout 'docs'))
        if ($resolved -ine $expected -or !$resolved.StartsWith($job + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Unsafe temporary path. Stopped.'
        }
        if ((Get-Item -LiteralPath $target -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Remote docs is a link. Stopped.'
        }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
    Copy-Item -LiteralPath $snapshot -Destination $target -Recurse -Force
    git -C $checkout add -A -- docs
    if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare upload.' }
    $changed = @(git -C $checkout diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect upload.' }
    if ($changed.Count -eq 0) {
        Write-Host 'Already up to date. Nothing to upload.' -ForegroundColor Green
        return
    }
    foreach ($path in $changed) {
        if (!$path.StartsWith('docs/')) { throw "Unexpected change outside docs: $path" }
    }
    git -C $checkout -c user.name=kds892222-maker -c user.email=kds892222-maker@users.noreply.github.com commit -m 'Update customer inventory docs'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }
    git -C $checkout -c http.sslBackend=openssl push origin HEAD:main
    if ($LASTEXITCODE -ne 0) {
        throw 'Upload failed or remote changed. Run again. No force push was used.'
    }
    Write-Host "Uploaded docs successfully ($count products). GitHub Pages deployment follows." -ForegroundColor Green
    Write-Host 'https://kds892222-maker.github.io/Online-Shop/'
}
catch {
    Write-Host "Stopped: $_" -ForegroundColor Red
}
finally {
    if ($job) { Write-Host "Upload snapshot retained: $job" }
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
    Read-Host 'Press Enter to close' | Out-Null
}
