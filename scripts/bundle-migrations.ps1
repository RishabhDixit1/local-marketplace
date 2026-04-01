# Bundle all migrations into one file
param([switch]$NewOnly)

$dir = Get-Location

if ($NewOnly) {
    # Only migrations from 20260329 onwards (not yet applied to production)
    $migrations = Get-ChildItem -Path (Join-Path $dir "supabase/migrations") -Filter "*.sql" |
        Where-Object { $_.Name -ge "20260329" } |
        Sort-Object Name
    $output = Join-Path $dir "supabase/new-migrations-bundle.sql"
    Write-Host "Bundling NEW migrations only (20260329+)..."
} else {
    $migrations = Get-ChildItem -Path (Join-Path $dir "supabase/migrations") -Filter "*.sql" | Sort-Object Name
    $output = Join-Path $dir "supabase-migrations-bundle.sql"
    Write-Host "Bundling ALL migrations..."
}

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("-- ServiQ Migrations Bundle -- $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("")

foreach ($file in $migrations) {
    Write-Host "  - $($file.Name)"
    [void]$sb.AppendLine("-- === $($file.Name) ===")
    [void]$sb.AppendLine([System.IO.File]::ReadAllText($file.FullName))
    [void]$sb.AppendLine("")
}

$sql = $sb.ToString()
[System.IO.File]::WriteAllText($output, $sql, [System.Text.Encoding]::UTF8)
Set-Clipboard -Value $sql

Write-Host ""
Write-Host "Done! File: $output"
Write-Host "Copied to clipboard - paste into Supabase SQL Editor"
