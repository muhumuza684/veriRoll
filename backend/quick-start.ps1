# VeriRoll - one-shot local quick start using SQLite (no Postgres needed).
# Run this FROM the backend folder: D:\Projects\veriRoll\backend

$ErrorActionPreference = "Stop"

# 1. Back up the Postgres schema (only if not already backed up) and
#    swap in the SQLite-compatible version.
if (-not (Test-Path "prisma\schema.postgres.prisma")) {
    Copy-Item "prisma\schema.prisma" "prisma\schema.postgres.prisma"
    Write-Host "Backed up original schema to prisma\schema.postgres.prisma" -ForegroundColor Yellow
}
Copy-Item "prisma\schema.sqlite.prisma" "prisma\schema.prisma" -Force

# 2. Write a working .env - SQLite file DB, no server needed, plus a
#    freshly generated JWT secret.
$jwtSecret = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
$envContent = 'DATABASE_URL="file:./dev.db"' + "`n" +
              ('JWT_SECRET="' + $jwtSecret + '"') + "`n" +
              'PORT=4000' + "`n"
Set-Content -Path ".env" -Value $envContent
Write-Host "Wrote .env with a local SQLite database and a generated JWT secret." -ForegroundColor Cyan

# 3. Generate the Prisma client and run the first migration.
npx prisma generate
npx prisma migrate dev --name init

# 4. Start the API.
Write-Host ""
Write-Host "Starting VeriRoll API on http://localhost:4000 ..." -ForegroundColor Green
npm run dev
