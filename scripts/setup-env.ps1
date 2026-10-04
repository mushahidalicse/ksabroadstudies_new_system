# Run once after closing the .env tab in the editor (file lock).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-env.ps1

$ErrorActionPreference = "Stop"
$envPath = Join-Path $PSScriptRoot "..\.env"
$bytes = New-Object byte[] 48

function RandToken([int]$len) {
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return (([Convert]::ToBase64String($bytes) -replace '[+/=]','')).Substring(0, $len)
}

if (-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item (Join-Path $PSScriptRoot "..\.env.example") $envPath
}

$lines = @(Get-Content -LiteralPath $envPath)
$map = [ordered]@{}
foreach ($line in $lines) {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $i = $line.IndexOf('=')
  $map[$line.Substring(0, $i)] = $line.Substring($i + 1)
}

function NeedsRotate([string]$v) {
  return [string]::IsNullOrWhiteSpace($v) -or $v.Length -lt 32 -or $v -match 'dev-session|ks-dev|change-me|ksabroad2027'
}

if (NeedsRotate ([string]$map['SESSION_SECRET'])) { $map['SESSION_SECRET'] = RandToken 48 }
if (NeedsRotate ([string]$map['PORTAL_JWT_SECRET'])) { $map['PORTAL_JWT_SECRET'] = RandToken 48 }
if (NeedsRotate ([string]$map['ADMIN_PASSWORD'])) { $map['ADMIN_PASSWORD'] = "ks-" + (RandToken 24) }
if ([string]::IsNullOrWhiteSpace([string]$map['NEXT_PUBLIC_SITE_URL'])) {
  $map['NEXT_PUBLIC_SITE_URL'] = "http://localhost:43127"
}
if ([string]::IsNullOrWhiteSpace([string]$map['OPENAI_MODEL'])) { $map['OPENAI_MODEL'] = "gpt-4o-mini" }
$map['CACHE_REVALIDATE_SECONDS'] = "120"
$map['CONSENT_POLICY_VERSION'] = "2026-09-20"
if (-not $map.Contains('CATALOGUE_API_KEY')) { $map['CATALOGUE_API_KEY'] = "" }
if (-not $map.Contains('TRUSTED_ORIGINS')) { $map['TRUSTED_ORIGINS'] = "" }

$order = @(
  'ADMIN_PASSWORD','SESSION_SECRET','PORTAL_JWT_SECRET','NEXT_PUBLIC_SITE_URL',
  'OPENAI_API_KEY','OPENAI_MODEL','CATALOGUE_API_KEY','TRUSTED_ORIGINS',
  'CACHE_REVALIDATE_SECONDS','CONSENT_POLICY_VERSION',
  'RESEND_API_KEY','RESEND_FROM','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM','CONTACT_TO_EMAIL'
)
$out = foreach ($k in $order) { "$k=$($map[$k])" }
Set-Content -LiteralPath $envPath -Value ($out -join [Environment]::NewLine) -Encoding UTF8
Write-Host "Updated .env (secrets not printed). Restart npm run dev."
Write-Host "Admin password length: $($map['ADMIN_PASSWORD'].Length)"
