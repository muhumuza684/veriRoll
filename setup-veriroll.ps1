# VeriRoll — local setup script (PowerShell)
# Run this from the folder where you downloaded veriroll-backend.zip and
# veriroll-frontend.zip. It creates a "veriroll" project folder, extracts
# both, installs backend dependencies, and prepares Prisma.

$ErrorActionPreference = "Stop"

$root = Join-Path -Path (Get-Location) -ChildPath "veriroll"
New-Item -ItemType Directory -Force -Path $root | Out-Null

Write-Host "Extracting backend..." -ForegroundColor Cyan
Expand-Archive -Path ".\veriroll-backend.zip" -DestinationPath $root -Force

Write-Host "Extracting frontend..." -ForegroundColor Cyan
Expand-Archive -Path ".\veriroll-frontend.zip" -DestinationPath $root -Force

$backendPath = Join-Path $root "veriroll-backend"
Set-Location $backendPath

Write-Host "Installing backend dependencies (npm install)..." -ForegroundColor Cyan
npm install

# Create a starter .env if one doesn't exist yet
$envPath = Join-Path $backendPath ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "Creating starter .env — edit DATABASE_URL and JWT_SECRET before running." -ForegroundColor Yellow
    @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veriroll"
JWT_SECRET="replace-with-a-long-random-string"
PORT=4000
"@ | Set-Content -Path $envPath
}

Write-Host ""
Write-Host "Done. Project structure:" -ForegroundColor Green
Write-Host "  $root\veriroll-backend   <- Node/Express/Prisma API"
Write-Host "  $root\veriroll-frontend  <- static mockup (index.html)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  1. Edit $backendPath\.env with your real Postgres URL and JWT secret"
Write-Host "  2. cd `"$backendPath`""
Write-Host "  3. npx prisma migrate dev --name init"
Write-Host "  4. npm run dev"
Write-Host ""
Write-Host "To view the frontend mockup, open:" -ForegroundColor Green
Write-Host "  $root\veriroll-frontend\index.html"
