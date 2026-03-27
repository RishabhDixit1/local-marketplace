# Bundle all migrations into one file
$dir = Get-Location
$migrations = Get-ChildItem -Path (Join-Path $dir "supabase/migrations") -Filter "*.sql" | Sort-Object Name
$output = Join-Path $dir "supabase-migrations-bundle.sql"

Write-Host "Bundling migrations..."

$allContent = @()
foreach ($file in $migrations) {
    Write-Host "  - $($file.Name)"
    $content = Get-Content $file.FullName -Raw
    $allContent += $content + "`n`n"
}

$allContent -join "" | Out-File $output -Encoding UTF8

Write-Host "Done! File: $output"
Write-Host ""
Write-Host "Next: Copy and paste this file contents into Supabase SQL Editor"
