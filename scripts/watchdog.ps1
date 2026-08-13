# Detects if Docker Desktop's engine has stopped (e.g. the client closed
# Docker Desktop by accident, or Windows restarted the machine) and
# automatically relaunches Docker Desktop and brings the site back up -
# so going there in person to restart it manually is only needed if this
# genuinely can't recover on its own (check the log below for that case).
#
# Also checks the site itself, not just the engine (added 2026-08-13,
# real incident - a customer in a different city hit a connection
# failure while `docker info`/container health looked completely fine
# the whole time). WSL2's own network relay (wslrelay.exe) is a known,
# separate point of failure from the Docker engine or containers
# themselves - it can get stuck while `docker info` and every container
# still report healthy, so the engine/container checks alone can't catch
# it. This escalates: try restarting just the frontend container first
# (cheap), and only restart Docker Desktop entirely if that doesn't fix
# it - a full restart is what actually resets a stuck WSL2 relay.
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
# running, the site itself is reachable, and no window is open, this
# does nothing and writes nothing to the log - the log exists to explain
# failures/actions, not to confirm routine health.
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

function Test-SiteReachable {
    # Real bug found and fixed 2026-08-13, same day this check was added:
    # this originally hit https://localhost/ to isolate the local Docker
    # path from DNS/router - but Caddy has no site block for "localhost"
    # at all (only broffice.bg and www.broffice.bg), so every single
    # check failed with a real TLS handshake error - not because the site
    # was down, but because Caddy correctly had nothing to serve for that
    # hostname. This caused the watchdog to "recover" a site that was
    # never actually broken, restarting Docker Desktop every single
    # minute for no reason. Testing the real hostname instead - same
    # method already proven reliable in the diagnostics workflow.
    try {
        $r = Invoke-WebRequest -Uri "https://www.broffice.bg/" -TimeoutSec 10 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Restart-DockerDesktopFully {
    # Shared by both failure paths below: the engine being down from the
    # start, and the engine looking fine but the site still not being
    # reachable even after a plain container restart (the WSL2-relay-
    # stuck scenario, which needs the whole of Docker Desktop restarted
    # to clear, not just a container).
    $proc = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Log "Stopping Docker Desktop so it can be relaunched cleanly."
        $proc | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }

    if (-not (Test-Path $DockerDesktopExe)) {
        Write-Log "ERROR: Docker Desktop.exe not found at $DockerDesktopExe - cannot auto-recover, manual intervention needed."
        return $false
    }
    Write-Log "Relaunching Docker Desktop."
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
        return $false
    }

    Write-Log "Docker engine is ready after ${waited}s. Bringing the site back up."
    Set-Location $DeployDir
    docker compose -f docker-compose.prod.yml up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: 'docker compose up -d' failed (exit $LASTEXITCODE) after the engine came back - manual check needed."
        return $false
    }
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
if ($LASTEXITCODE -ne 0) {
    Write-Log "Docker engine is not responding - checking if Docker Desktop is running."
    if (-not (Restart-DockerDesktopFully)) { exit 1 }
    Write-Log "Recovered successfully - site is back up."
    exit 0
}

# Engine is fine. Idempotent no-op if the stack already matches - cheap
# defensive fallback for "engine's up but a container isn't" without
# needing a separate status-parsing check.
#
# Deliberately not redirecting docker's own stderr (e.g. `*> $null`) -
# PowerShell 5.1 wraps a native command's stderr lines in a
# NativeCommandError and sets $? to false even on a real exit code 0,
# which under $ErrorActionPreference = "Stop" throws here even after a
# genuinely successful recovery (verified: the container came back up
# but the script errored out before logging success).
Set-Location $DeployDir
docker compose -f docker-compose.prod.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR: engine is up but 'docker compose up -d' failed (exit $LASTEXITCODE) - manual check needed."
    exit 1
}

if (Test-SiteReachable) {
    exit 0
}

Write-Log "Docker and containers look healthy, but the site itself isn't responding locally - likely a stuck WSL2 network relay, not an engine problem. Restarting the frontend container."
docker compose -f docker-compose.prod.yml restart frontend
Start-Sleep -Seconds 8

if (Test-SiteReachable) {
    Write-Log "Frontend restart fixed it - site responding again."
    exit 0
}

Write-Log "Frontend restart didn't fix it - restarting Docker Desktop entirely (a full restart is what actually clears a stuck WSL2 relay)."
if (-not (Restart-DockerDesktopFully)) { exit 1 }

if (Test-SiteReachable) {
    Write-Log "Recovered successfully after a full Docker Desktop restart - site is back up."
    exit 0
} else {
    Write-Log "ERROR: still not reachable even after a full Docker Desktop restart - needs manual investigation."
    exit 1
}
