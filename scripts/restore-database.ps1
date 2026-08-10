# Restores the database from a backup made by backup-database.ps1.
# Deliberately a command someone runs on purpose, not a button in the
# admin panel - see the conversation this was built from: a restore
# replaces whatever's currently live, and the app trying to restore its
# own database while running and connected to it is a genuinely risky
# self-referential operation. This script stops the app cleanly first,
# specifically to avoid that problem.
#
# Usage (as Administrator):
#   powershell -ExecutionPolicy Bypass -File "C:\path\to\restore-database.ps1"
#   (lists available backups, asks you to pick one, confirms before doing
#   anything destructive)

param(
    [string]$DeployDir = "C:\actions-runner\_work\broffice-app\broffice-app",
    [string]$BackupRoot = "C:\broffice-backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupRoot)) {
    throw "No backups found - $BackupRoot doesn't exist yet"
}
$backups = Get-ChildItem $BackupRoot -Directory | Sort-Object Name -Descending
if ($backups.Count -eq 0) {
    throw "No backups found in $BackupRoot"
}

Write-Host "=== Available backups ===" -ForegroundColor Cyan
for ($i = 0; $i -lt $backups.Count; $i++) {
    $dbFile = Join-Path $backups[$i].FullName "database.sql"
    $size = if (Test-Path $dbFile) { "$([math]::Round((Get-Item $dbFile).Length / 1KB)) KB" } else { "MISSING database.sql - skip this one" }
    Write-Host "  [$i] $($backups[$i].Name)  ($size)"
}

$choice = Read-Host "`nWhich one? (enter the number)"
$selected = $backups[[int]$choice]
$dbFile = Join-Path $selected.FullName "database.sql"
if (-not (Test-Path $dbFile)) {
    throw "database.sql not found in $($selected.FullName) - can't restore this one"
}

Write-Host ""
Write-Host "About to restore from: $($selected.Name)" -ForegroundColor Yellow
Write-Host "THIS REPLACES THE CURRENT LIVE DATABASE. Anything created after $($selected.Name) will be gone." -ForegroundColor Red
$confirm = Read-Host "Type the backup name exactly ($($selected.Name)) to confirm"
if ($confirm -ne $selected.Name) {
    Write-Host "Names didn't match - aborted, nothing was touched." -ForegroundColor Yellow
    exit 1
}

$envPath = Join-Path $DeployDir ".env"
$envValues = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') { $envValues[$Matches[1]] = $Matches[2] }
}
$pgUser = $envValues["POSTGRES_USER"]
$pgDb = $envValues["POSTGRES_DB"]
$pgPassword = $envValues["POSTGRES_PASSWORD"]

Set-Location $DeployDir

Write-Host "`n=== Stopping the app (backend/celery) so nothing writes to the database mid-restore ===" -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml stop backend celery-worker celery-beat

Write-Host "=== Restoring database.sql ===" -ForegroundColor Cyan
Get-Content $dbFile | docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD=$pgPassword postgres psql -U $pgUser -d $pgDb
if ($LASTEXITCODE -ne 0) {
    Write-Host "psql reported errors above - check them before trusting this restore." -ForegroundColor Yellow
}

$mediaZip = Join-Path $selected.FullName "media.zip"
if (Test-Path $mediaZip) {
    Write-Host "=== Restoring media/ ===" -ForegroundColor Cyan
    $mediaPath = Join-Path $DeployDir "media"
    if (Test-Path $mediaPath) { Remove-Item $mediaPath -Recurse -Force }
    Expand-Archive -Path $mediaZip -DestinationPath $DeployDir -Force
}

Write-Host "=== Restarting the app ===" -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml start backend celery-worker celery-beat

Write-Host ""
Write-Host "=== Done. Restored from $($selected.Name). ===" -ForegroundColor Green
