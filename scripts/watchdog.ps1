# Detects if Docker Desktop's engine has stopped (e.g. the client closed
# Docker Desktop by accident, or Windows restarted the machine) and
# automatically relaunches Docker Desktop and brings the site back up -
# so going there in person to restart it manually is only needed if this
# genuinely can't recover on its own (check the log below for that case).
#
# All services in docker-compose.prod.yml use `restart: unless-stopped`,
# so once the Docker engine itself is back up, Docker normally restarts
# the containers on its own - the `docker compose up -d` calls below are
# a defensive fallback for cases where that doesn't happen on its own
# (e.g. a container crash-looped past Docker's own retry budget, or the
# machine rebooted with Docker Desktop not set to auto-start).
#
# Meant to run on a short interval via Windows Task Scheduler (every 5
# minutes is plenty - relaunching Docker Desktop takes ~1-2 minutes on
# its own, so checking much more often just wastes CPU). If the engine
# is already up and the stack is already running, this does nothing and
# writes nothing to the log - the log exists to explain failures, not to
# confirm routine health.
#
# One-time setup (run once, as Administrator):
#   schtasks /create /tn "BRoffice Docker Watchdog" /tr "powershell.exe -ExecutionPolicy Bypass -File \"C:\path\to\watchdog.ps1\"" /sc minute /mo 5 /ru SYSTEM
#
# Manual run / test: just run this script directly, no flags needed.

param(
    [string]$DeployDir = "C:\actions-runner\_work\broffice-app\broffice-app",
    [string]$DockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe",
    [string]$LogFile = "C:\broffice-backups\watchdog.log",
    [int]$EngineTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"

function Write-Log([string]$msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

# Keep the log from growing forever - this fires every few minutes,
# indefinitely, so an unbounded file would otherwise be inevitable.
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 2MB) {
    $tail = Get-Content $LogFile -Tail 500
    Set-Content -Path $LogFile -Value $tail
}

docker info 1> $null
if ($LASTEXITCODE -eq 0) {
    # Engine is fine. Idempotent no-op if the stack already matches -
    # cheap defensive fallback for "engine's up but a container isn't"
    # without needing a separate status-parsing check.
    #
    # Deliberately not redirecting docker's own stderr (e.g. `*> $null`) -
    # PowerShell 5.1 wraps a native command's stderr lines in a
    # NativeCommandError and sets $? to false even on a real exit code 0,
    # which under $ErrorActionPreference = "Stop" throws here even after
    # a genuinely successful recovery (verified: the container came back
    # up but the script errored out before logging success).
    Set-Location $DeployDir
    docker compose -f docker-compose.prod.yml up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: engine is up but 'docker compose up -d' failed (exit $LASTEXITCODE) - manual check needed."
        exit 1
    }
    exit 0
}

Write-Log "Docker engine is not responding - checking if Docker Desktop is running."

$proc = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Log "Docker Desktop is not running (likely closed by accident) - relaunching."
    if (-not (Test-Path $DockerDesktopExe)) {
        Write-Log "ERROR: Docker Desktop.exe not found at $DockerDesktopExe - cannot auto-recover, manual intervention needed."
        exit 1
    }
    Start-Process $DockerDesktopExe
} else {
    Write-Log "Docker Desktop process is running but the engine isn't responding yet - waiting for it to finish starting."
}

Write-Log "Waiting up to $EngineTimeoutSeconds seconds for the Docker engine to become ready..."
$waited = 0
$ready = $false
while ($waited -lt $EngineTimeoutSeconds) {
    Start-Sleep -Seconds 10
    $waited += 10
    docker info 1> $null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
}

if (-not $ready) {
    Write-Log "ERROR: Docker engine still not responding after $EngineTimeoutSeconds seconds - needs manual intervention (open Docker Desktop and check for errors)."
    exit 1
}

Write-Log "Docker engine is ready after ${waited}s. Bringing the site back up."
Set-Location $DeployDir
docker compose -f docker-compose.prod.yml up -d
if ($LASTEXITCODE -eq 0) {
    Write-Log "Recovered successfully - site is back up."
} else {
    Write-Log "ERROR: 'docker compose up -d' failed (exit $LASTEXITCODE) after the engine came back - manual check needed."
    exit 1
}
