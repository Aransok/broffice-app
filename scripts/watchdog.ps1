# Detects if Docker Desktop's engine has stopped (e.g. the client closed
# Docker Desktop by accident, or Windows restarted the machine) and
# automatically relaunches Docker Desktop and brings the site back up -
# so going there in person to restart it manually is only needed if this
# genuinely can't recover on its own (check the log below for that case).
#
# Also force-minimizes Docker Desktop's window whenever it's open - the
# client only needs the background engine, never the GUI, and a surprise
# window popping up (at boot, after a relaunch, or if they double-click
# the icon themselves) is exactly what leads to them closing it, which is
# the problem this script exists to recover from. A Startup-shortcut
# "run minimized" hint does NOT work here (tested directly: Docker
# Desktop is Electron-based and shows its window regardless) - forcing it
# via the Win32 API afterward does work (also tested directly).
#
# All services in docker-compose.prod.yml use `restart: unless-stopped`,
# so once the Docker engine itself is back up, Docker normally restarts
# the containers on its own - the `docker compose up -d` calls below are
# a defensive fallback for cases where that doesn't happen on its own
# (e.g. a container crash-looped past Docker's own retry budget, or the
# machine rebooted with Docker Desktop not set to auto-start).
#
# Meant to run on a short interval via Windows Task Scheduler (every 1
# minute - cheap on the healthy path, and keeps the window-minimizing
# reaction fast). If the engine is already up, the stack is already
# running, and no window is open, this does nothing and writes nothing to
# the log - the log exists to explain failures/actions, not to confirm
# routine health.
#
# One-time setup (run once, as Administrator):
#   schtasks /create /tn "BRoffice Docker Watchdog" /tr "powershell.exe -ExecutionPolicy Bypass -File \"C:\path\to\watchdog.ps1\"" /sc minute /mo 1 /ru SYSTEM
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

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class BRofficeWin32 {
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

function Set-DockerWindowMinimized {
    $proc = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if (-not $proc) { return $false }
    if ([BRofficeWin32]::IsIconic($proc.MainWindowHandle)) { return $false }
    [BRofficeWin32]::ShowWindowAsync($proc.MainWindowHandle, 6) | Out-Null  # SW_MINIMIZE
    return $true
}

New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

# Keep the log from growing forever - this fires every minute,
# indefinitely, so an unbounded file would otherwise be inevitable.
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 2MB) {
    $tail = Get-Content $LogFile -Tail 500
    Set-Content -Path $LogFile -Value $tail
}

if (Set-DockerWindowMinimized) {
    Write-Log "Docker Desktop window was open - minimized it."
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
    # Its window will appear a few seconds after the process starts, not
    # immediately - poll briefly so the minimize actually lands instead of
    # missing an empty MainWindowHandle on the first try.
    $minimizeWait = 0
    while ($minimizeWait -lt 30) {
        Start-Sleep -Seconds 2
        $minimizeWait += 2
        if (Set-DockerWindowMinimized) {
            Write-Log "Minimized the Docker Desktop window after relaunch."
            break
        }
    }
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
