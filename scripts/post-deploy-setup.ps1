# Run this once, right after the first successful production deploy
# (docs/GO_LIVE_CHECKLIST.txt Phase 2) - a fresh database has no product
# data and no admin account yet (both are just empty tables at that
# point), so nothing can be clicked through the UI until this runs once.
# Automates checklist steps 4a/4b: creates your first admin account and
# pulls the real product catalog. Safe to re-run (createsuperuser will
# just fail harmlessly with "username already exists" if run twice; the
# sync is always safe to re-run).
#
# Usage: from the deploy directory (where docker-compose.prod.yml is):
#   powershell -ExecutionPolicy Bypass -File "C:\path\to\post-deploy-setup.ps1"

$ErrorActionPreference = "Stop"

if (-not (Test-Path "docker-compose.prod.yml")) {
    throw "Run this from the deploy directory (the one with docker-compose.prod.yml in it) - e.g. C:\actions-runner\_work\broffice-app\broffice-app"
}

Write-Host "=== Create your admin account ===" -ForegroundColor Cyan
$adminUser = Read-Host "Admin username"
$adminEmail = Read-Host "Admin email"
$adminPassSecure = Read-Host "Admin password" -AsSecureString
$adminPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassSecure))

docker compose -f docker-compose.prod.yml exec -T `
    -e DJANGO_SUPERUSER_USERNAME=$adminUser `
    -e DJANGO_SUPERUSER_EMAIL=$adminEmail `
    -e DJANGO_SUPERUSER_PASSWORD=$adminPass `
    backend python manage.py createsuperuser --noinput
if ($LASTEXITCODE -ne 0) {
    Write-Host "createsuperuser failed - if it's because that username already exists, that's fine, continuing." -ForegroundColor Yellow
} else {
    Write-Host "Admin account created." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Pulling the real product catalog (~3,300 products, takes a few minutes) ===" -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml exec -T backend python manage.py sync_supplier_catalog

Write-Host ""
Write-Host "=== Done. Log in with the admin account you just created. ===" -ForegroundColor Green
