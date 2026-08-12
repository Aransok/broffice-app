# Registers the Docker Watchdog as a scheduled task that runs in the
# CURRENT user's real interactive session, not as SYSTEM.
#
# Why: verified directly (2026-08-12) that watchdog.ps1 launched via a
# SYSTEM-context task cannot actually relaunch Docker Desktop - Windows
# isolates SYSTEM tasks into "Session 0", which has no real desktop, so
# the Electron GUI process starts but never finishes initializing
# (confirmed: real "Docker Desktop.exe" processes appeared, but every one
# had MainWindowHandle 0 and the engine never came up). The exact same
# script run via a task with -LogonType Interactive (this script) DID
# work end-to-end: relaunch, minimize, engine ready, site back up, in
# ~20 seconds - proven with a real stop/relaunch/recovery cycle.
#
# -LogonType Interactive means this only runs while the target user has
# a real logged-in session (silently skips otherwise, tries again next
# minute) - no password needs to be stored for it. That's exactly why
# auto-login for that account matters: it's what guarantees a session
# actually exists after an unattended reboot for this to run in.
#
# The other two scheduled jobs (backup-database.ps1, restore-watcher.ps1)
# do NOT need this - they only run docker/pg_dump/compose commands, no
# GUI, so SYSTEM is correct and preferable for those (works with no user
# logged in at all, which is what you want for a 1am backup).
#
# Usage: run once, as the SAME user who will normally be logged into
# this machine (auto-login should log into this same account):
#   powershell -ExecutionPolicy Bypass -File "C:\path\to\register-watchdog-task.ps1"

param(
    [string]$WatchdogScript = "$PSScriptRoot\watchdog.ps1",
    [string]$DeployDir = "C:\actions-runner\_work\broffice-app\broffice-app",
    [string]$LogFile = "C:\broffice-backups\watchdog.log",
    [string]$TaskName = "BRoffice Docker Watchdog"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $WatchdogScript)) {
    throw "watchdog.ps1 not found at $WatchdogScript - pass -WatchdogScript if it's elsewhere."
}

$argList = "-ExecutionPolicy Bypass -File `"$WatchdogScript`" -DeployDir `"$DeployDir`" -LogFile `"$LogFile`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argList
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
# LeastPrivilege/Limited, not Highest - launching Docker Desktop normally
# doesn't need admin rights, same as double-clicking its icon by hand.
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null

Write-Host "Registered '$TaskName' to run every minute as $env:USERNAME (interactive session required)." -ForegroundColor Green
Write-Host "Verify: Get-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor Green
