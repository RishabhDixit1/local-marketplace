# PowerShell script to apply Supabase migrations via SQL Editor
# Usage: .\scripts\apply-migrations.ps1

$migrationsPath = "supabase/migrations"
$outputFile = "supabase/migrations-bundle.sql"

# Get all migration files sorted by date
$migrations = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name

Write-Host "Found $($migrations.Count) migration files" -ForegroundColor Green
Write-Host ""

# Combine all migrations into one file
$allMigrations = @()

foreach ($file in $migrations) {
    Write-Host "Adding: $($file.Name)"
    $content = Get-Content -Path $file.FullName -Raw
    $allMigrations += $content
    $allMigrations += "`n`n"
}

# Write to output file
$allMigrations | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "✓ Bundle created: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open your Supabase project dashboard"
Write-Host "2. Go to SQL Editor and create a New Query"
Write-Host "3. Paste the contents of: $outputFile"
Write-Host "4. Click Run"
Write-Host ""
Write-Host "To copy to clipboard, run:"
Write-Host ("Get-Content " + $outputFile + " | Set-Clipboard")
