# Nightly backup: real Postgres database dump + the media/ folder (real
# uploaded product images), into a dated folder, with automatic pruning
# of old backups so disk usage doesn't grow forever.
#
# Uses Windows Task Scheduler, not a GitHub Actions cron - a scheduled
# GitHub Action silently stops firing after 60 days of repo inactivity
# (a real, documented GitHub behavior), and depends on internet
# connectivity for something that's fundamentally a local operation.
# Task Scheduler is native, reliable, and has neither problem.
#
# One-time setup (run once, as Administrator):
#   schtasks /create /tn "BRoffice Nightly Backup" /tr "powershell.exe -ExecutionPolicy Bypass -File \"C:\path\to\backup-database.ps1\"" /sc daily /st 01:00 /ru SYSTEM
#
# Manual run / test: just run this script directly, no flags needed.

param(
    [string]$DeployDir = "C:\actions-runner\_work\broffice-app\broffice-app",
    [string]$BackupRoot = "C:\broffice-backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $DeployDir "docker-compose.prod.yml"))) {
    throw "docker-compose.prod.yml not found in $DeployDir - pass -DeployDir if it's somewhere else"
}
$envPath = Join-Path $DeployDir ".env"
if (-not (Test-Path $envPath)) {
    throw ".env not found at $envPath"
}

# Read POSTGRES_* values directly out of the real .env - avoids hardcoding
# or re-prompting for values that are already defined there.
$envValues = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') {
        $envValues[$Matches[1]] = $Matches[2]
    }
}
$pgUser = $envValues["POSTGRES_USER"]
$pgDb = $envValues["POSTGRES_DB"]
$pgPassword = $envValues["POSTGRES_PASSWORD"]
if (-not $pgUser -or -not $pgDb -or -not $pgPassword) {
    throw "POSTGRES_USER/POSTGRES_DB/POSTGRES_PASSWORD not all found in $envPath"
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$dest = Join-Path $BackupRoot $timestamp
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Set-Location $DeployDir

Write-Host "=== Backing up database to $dest\database.sql ===" -ForegroundColor Cyan
# Writes the dump to a file INSIDE the container first (via the
# container's own shell), then `docker compose cp` does a pure binary
# copy out - deliberately avoids piping the dump through PowerShell's
# text pipeline at all. PowerShell's `>`/Out-File redirect encoding is
# environment-dependent and was found to silently corrupt this exact
# dump (verified: interleaved stray bytes, real Cyrillic product/category
# names unreadable) when tested the naive way (`pg_dump ... > file.sql`).
docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD=$pgPassword postgres `
    sh -c "pg_dump -U '$pgUser' -d '$pgDb' --clean --if-exists > /tmp/backup.sql"
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
}
docker compose -f docker-compose.prod.yml cp "postgres:/tmp/backup.sql" (Join-Path $dest "database.sql")
docker compose -f docker-compose.prod.yml exec -T postgres rm -f /tmp/backup.sql
if ($LASTEXITCODE -ne 0) {
    throw "copying the dump out of the container failed with exit code $LASTEXITCODE"
}
$dumpSize = (Get-Item (Join-Path $dest "database.sql")).Length
if ($dumpSize -eq 0) {
    throw "database.sql is empty - something went wrong, not treating this as a valid backup"
}
Write-Host "Database backed up ($([math]::Round($dumpSize/1KB)) KB)." -ForegroundColor Green

$mediaPath = Join-Path $DeployDir "media"
if (Test-Path $mediaPath) {
    Write-Host "=== Backing up media/ to $dest\media.zip ===" -ForegroundColor Cyan
    Compress-Archive -Path $mediaPath -DestinationPath (Join-Path $dest "media.zip") -Force
    Write-Host "Media backed up." -ForegroundColor Green
} else {
    Write-Host "No media/ folder found - skipping (nothing uploaded yet)." -ForegroundColor Yellow
}

Write-Host "=== Pruning backups older than $RetentionDays days ===" -ForegroundColor Cyan
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $BackupRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.CreationTime -lt $cutoff } |
    ForEach-Object {
        Write-Host "Removing old backup: $($_.Name)"
        Remove-Item $_.FullName -Recurse -Force
    }

Write-Host ""
Write-Host "=== Done: $dest ===" -ForegroundColor Green
