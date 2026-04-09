param(
  [string]$DeviceId = "emulator-5554",
  [string]$ApiBaseUrl = "http://10.0.2.2:3000",
  [string]$EnvFile = ".env.local",
  [string]$AppEnv = "development",
  [switch]$PrintOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot "mobile"
$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
  $EnvFile
} else {
  Join-Path $repoRoot $EnvFile
}

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Env file not found: $envPath"
}

$envLines = Get-Content -LiteralPath $envPath

function Get-EnvValue {
  param([string]$Key)

  $prefix = "$Key="
  $line = $envLines | Where-Object { $_.StartsWith($prefix) } | Select-Object -First 1
  if (-not $line) {
    throw "Missing $Key in $envPath"
  }

  return $line.Substring($prefix.Length).Trim()
}

$supabaseUrl = Get-EnvValue "NEXT_PUBLIC_SUPABASE_URL"
$supabaseAnonKey = Get-EnvValue "NEXT_PUBLIC_SUPABASE_ANON_KEY"

$flutterCommand = Get-Command flutter.bat -ErrorAction SilentlyContinue
if ($flutterCommand) {
  $flutterExe = $flutterCommand.Source
} else {
  $flutterExe = "C:\src\flutter\bin\flutter.bat"
}

if (-not (Test-Path -LiteralPath $flutterExe)) {
  throw "Flutter executable not found at $flutterExe"
}

$maskedKey = if ($supabaseAnonKey.Length -gt 12) {
  "{0}...{1}" -f $supabaseAnonKey.Substring(0, 6), $supabaseAnonKey.Substring($supabaseAnonKey.Length - 4)
} else {
  "[set]"
}

Write-Host "Using env file: $envPath"
Write-Host "Device: $DeviceId"
Write-Host "Supabase host: $supabaseUrl"
Write-Host "Anon key: $maskedKey"
Write-Host "API base URL: $ApiBaseUrl"

$flutterArgs = @(
  "run",
  "-d", $DeviceId,
  "--dart-define=APP_ENV=$AppEnv",
  "--dart-define=SUPABASE_URL=$supabaseUrl",
  "--dart-define=SUPABASE_ANON_KEY=$supabaseAnonKey",
  "--dart-define=API_BASE_URL=$ApiBaseUrl",
  "--dart-define=AUTH_REDIRECT_SCHEME=serviq",
  "--dart-define=AUTH_REDIRECT_HOST=auth-callback"
)

if ($PrintOnly) {
  Write-Host ""
  Write-Host "Resolved flutter command:"
  Write-Host "$flutterExe $($flutterArgs -join ' ')"
  exit 0
}

Push-Location $mobileDir
try {
  & $flutterExe @flutterArgs
} finally {
  Pop-Location
}
