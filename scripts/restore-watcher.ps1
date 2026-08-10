# Watches for a restore request written by the admin panel (backend/backups
# app) and performs the actual restore - deliberately NOT done inside the
# running Django container (see backend/backups/services.py for why: it'd
# be dropping/reloading the very database that process is connected to).
#
# Meant to run on a short interval via Windows Task Scheduler (every 1-2
# minutes is plenty - a restore isn't time-critical to the second). If
# there's no pending request, this exits immediately and does nothing.
#
# One-time setup (run once, as Administrator):
#   schtasks /create /tn "BRoffice Restore Watcher" /tr "powershell.exe -ExecutionPolicy Bypass -File \"C:\path\to\restore-watcher.ps1\"" /sc minute /mo 1 /ru SYSTEM

param(
    [string]$DeployDir = "C:\actions-runner\_work\broffice-app\broffice-app",
    [string]$BackupRoot = "C:\broffice-backups"
)

$ErrorActionPreference = "Stop"
$requestFile = Join-Path $BackupRoot "_restore_request.txt"
$statusFile = Join-Path $BackupRoot "_restore_status.txt"

if (-not (Test-Path $requestFile)) {
    exit 0  # nothing to do - the normal case, every time this fires
}

$backupName = (Get-Content $requestFile -Raw).Trim()
$backupDir = Join-Path $BackupRoot $backupName
$dbFile = Join-Path $backupDir "database.sql"

function Write-Status([string]$msg) {
    # Windows PowerShell 5.1's Set-Content -Encoding utf8 always adds a BOM
    # - found by actually running this and checking the real file: the BOM
    # broke backend/backups/services.py's startswith("done:") check, so the
    # UI reported "still restoring" forever after a real successful
    # restore. Writing via .NET directly avoids it.
    [System.IO.File]::WriteAllText($statusFile, $msg, (New-Object System.Text.UTF8Encoding $false))
}

try {
    if (-not (Test-Path $dbFile)) {
        throw "database.sql not found for backup '$backupName'"
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

    Write-Status "Stopping the app..."
    docker compose -f docker-compose.prod.yml stop backend celery-worker celery-beat
    if ($LASTEXITCODE -ne 0) { throw "Failed to stop the app (exit $LASTEXITCODE)" }

    Write-Status "Restoring database from $backupName..."
    # Binary-safe copy into the container first, then restore from there -
    # same reasoning as backup-database.ps1: avoid PowerShell's text
    # pipeline entirely for this (verified elsewhere to silently corrupt
    # non-ASCII content otherwise).
    docker compose -f docker-compose.prod.yml cp $dbFile "postgres:/tmp/restore.sql"
    if ($LASTEXITCODE -ne 0) { throw "Failed to copy dump into the postgres container (exit $LASTEXITCODE)" }
    docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD=$pgPassword postgres `
        sh -c "psql -U '$pgUser' -d '$pgDb' -f /tmp/restore.sql"
    if ($LASTEXITCODE -ne 0) { throw "psql restore failed (exit $LASTEXITCODE) - check backend logs" }
    docker compose -f docker-compose.prod.yml exec -T postgres rm -f /tmp/restore.sql

    $mediaZip = Join-Path $backupDir "media.zip"
    if (Test-Path $mediaZip) {
        Write-Status "Restoring media..."
        $mediaPath = Join-Path $DeployDir "media"
        if (Test-Path $mediaPath) { Remove-Item $mediaPath -Recurse -Force }
        Expand-Archive -Path $mediaZip -DestinationPath $DeployDir -Force
    }

    Write-Status "Restarting the app..."
    docker compose -f docker-compose.prod.yml start backend celery-worker celery-beat
    if ($LASTEXITCODE -ne 0) { throw "Restore succeeded but restarting the app failed (exit $LASTEXITCODE) - start it manually" }

    Write-Status "done: $backupName"
} catch {
    Write-Status "error: $($_.Exception.Message)"
    # Try to bring the app back up regardless of where the failure was -
    # a failed restore should not also leave the site down.
    try {
        Set-Location $DeployDir
        docker compose -f docker-compose.prod.yml start backend celery-worker celery-beat
    } catch {}
} finally {
    Remove-Item $requestFile -Force -ErrorAction SilentlyContinue
}
