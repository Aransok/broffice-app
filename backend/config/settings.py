"""
Django settings for Broffice (Office Center rebuild).
"""

import os
import sys
from decimal import Decimal
from pathlib import Path

from celery.schedules import crontab
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")

# Windows' console defaults to the system codepage (often cp1252), which
# can't encode Cyrillic — every Bulgarian-language email/log line this
# project prints would crash `runserver` with a UnicodeEncodeError the
# moment the console (`EMAIL_BACKEND=...console.EmailBackend`) tries to
# print one. Linux/production already default to UTF-8, so this is a no-op
# there; only Windows dev needs the explicit reconfigure.
if sys.platform == "win32":
    for _stream in (sys.stdout, sys.stderr):
        if hasattr(_stream, "reconfigure"):
            _stream.reconfigure(encoding="utf-8", errors="replace")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in {"1", "true", "yes"}

# Fail loudly at startup rather than silently running a production site with
# a weak/placeholder key — Django's session signing, password reset tokens,
# and CSRF protection are all only as strong as this value. Same heuristic
# Django's own `manage.py check --deploy` (security.W009) uses (length,
# character variety, "django-insecure-" prefix) — checked here explicitly,
# not left to the client to remember to run --deploy, plus it also catches
# .env.example's own literal placeholder string still sitting unreplaced in
# a real .env, which W009's generic heuristic wouldn't specifically know to
# flag as *the* known-bad value for this project.
_secret_key_is_weak = (
    len(SECRET_KEY) < 50
    or len(set(SECRET_KEY)) < 5
    or SECRET_KEY.startswith("django-insecure-")
    or SECRET_KEY == "change-me-to-a-long-random-string"
)
if not DEBUG and _secret_key_is_weak:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY is missing, too weak, or still a placeholder while "
        "DEBUG=False. Generate a real one and set it in .env: python -c "
        '"from django.core.management.utils import get_random_secret_key; '
        'print(get_random_secret_key())"'
    )

ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "django_filters",
    "corsheaders",
    # Local
    "core",
    "common",
    "accounts",
    "categories",
    "brands",
    "products",
    "pages",
    "navigation",
    "seo",
    "pricing",
    "promotions",
    "banners",
    "coupons",
    "favorites",
    "activity",
    "carts",
    "orders",
    "shipping",
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database: PostgreSQL when POSTGRES_HOST is a non-empty value, else SQLite for local bootstrap
_pg_host = (os.getenv("POSTGRES_HOST") or "").strip()
if _pg_host:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "broffice"),
            "USER": os.getenv("POSTGRES_USER", "broffice"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "broffice_secret"),
            "HOST": _pg_host,
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "bg"
TIME_ZONE = "Europe/Sofia"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = PROJECT_ROOT / "static"
MEDIA_URL = "/media/"
_media = (os.getenv("MEDIA_ROOT") or "").strip()
MEDIA_ROOT = Path(_media) if _media else (PROJECT_ROOT / "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django's default cache (LocMemCache) is process-local — fine for a single
# dev server process, but under gunicorn with multiple worker processes in
# production, each worker keeps its own separate rate-limit counters,
# making DRF's throttling (see REST_FRAMEWORK below) far less effective
# than its configured rate implies. Redis is already required in
# production anyway (Celery broker, docker-compose's redis service) —
# reused here as a shared cache so throttling actually works across all
# workers. Left as Django's default in dev (DEBUG=True) so a bare
# `manage.py runserver`/pytest run without Redis running still works.
if not DEBUG:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        }
    }

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 24,
    # ScopedRateThrottle only actually throttles a view that opts in via its
    # own `throttle_scope` attribute — declaring it here globally is a no-op
    # for the storefront's public browsing endpoints (product/category
    # listings etc.), which stay unthrottled. Applied explicitly to the
    # auth-sensitive views (login, register, password reset, change
    # password) via throttle_scope = "auth" — see api/views.py.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth": "10/min",
    },
}

# Env-driven, same pattern as ALLOWED_HOSTS above, so the real production
# domain(s) can be trusted via .env alone — no code change needed per
# deployment. Defaults cover local dev only.
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "DJANGO_CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# CSRF: the React SPA (localhost:5173) is cross-port from Django (localhost:8000).
# Django requires the SPA's origin to be trusted, and the csrftoken cookie must
# stay JS-readable (CSRF_COOKIE_HTTPONLY=False, the default) so axios can attach it.
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SAMESITE = "Lax"

# HTTPS is opt-in via env, not tied to DEBUG=False — this project's first
# production deploy is self-hosted on the client's own machine (see
# deployment planning notes) and may go live before a TLS certificate is
# actually wired up. Forcing SECURE_SSL_REDIRECT/secure cookies before HTTPS
# really works would just break the site (redirect loop, cookies silently
# dropped) rather than protect anything. Flip DJANGO_HTTPS_ENABLED=True once
# a real certificate is live in front of the app.
DJANGO_HTTPS_ENABLED = os.getenv("DJANGO_HTTPS_ENABLED", "False").lower() in {
    "1",
    "true",
    "yes",
}
if DJANGO_HTTPS_ENABLED:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year — the standard once TLS is confirmed stable
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # Set when a reverse proxy (Nginx, per this project's docker-compose/
    # deployment docs) terminates TLS and forwards plain HTTP internally —
    # without this, Django can't tell the original request was HTTPS and
    # SECURE_SSL_REDIRECT loops forever.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CELERY_BROKER_URL = os.getenv(
    "CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0")
)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
# Dev/tests run tasks synchronously in-process rather than requiring a real
# Redis broker + worker just to be running locally — production (DEBUG=False,
# behind the docker-compose celery-worker/celery-beat services) still queues
# for real. First real use: banners/signals.py's Promotion post_save/
# post_delete -> sync_banners_task.delay().
CELERY_TASK_ALWAYS_EAGER = DEBUG
CELERY_TASK_EAGER_PROPAGATES = DEBUG
CELERY_BEAT_SCHEDULE = {
    # Catches pure date-expiry (a promotion's start/end date passing with
    # nobody touching the admin panel) — the signal-driven path in
    # banners/signals.py handles every actual create/edit/delete already.
    "sync-banners": {
        "task": "banners.tasks.sync_banners_task",
        "schedule": 600.0,
    },
    # Same sync the admin's manual "Sync" button runs (api/views.py
    # ProductViewSet.sync) — 03:00 server time, off-peak, so nobody's
    # mid-checkout while ~3000+ products get upserted. Previously only ran
    # when an admin remembered to click the button.
    "sync-supplier-catalog": {
        "task": "products.tasks.sync_supplier_catalog_task",
        "schedule": crontab(hour=3, minute=0),
    },
}

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() in {"1", "true", "yes"}
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@broffice.local")
ADMIN_ORDER_EMAIL = os.getenv("ADMIN_ORDER_EMAIL", "admin@broffice.local")

# Used to build links in outgoing emails (password reset, etc.) that point at
# the React SPA rather than the Django backend itself.
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

# Official company details, as provided by the client — used on invoices,
# emails, and (in a later phase) the Contact/About/legal pages. Only the
# facts actually given are defaulted here; anything not provided (VAT number,
# bank details, etc.) stays an empty string rather than being invented, and
# every value is env-overridable so nothing is hardcoded twice.
COMPANY_NAME = os.getenv("COMPANY_NAME", "БРАЯ 2020 ЕООД")
COMPANY_EIK = os.getenv("COMPANY_EIK", "206313018")
COMPANY_VAT_NUMBER = os.getenv("COMPANY_VAT_NUMBER", "")
COMPANY_ADDRESS = os.getenv("COMPANY_ADDRESS", "гр. Пловдив, жк. Тракия, блок 229")
COMPANY_EMAIL = os.getenv("COMPANY_EMAIL", "broffice.bg@gmail.com")
COMPANY_PHONE = os.getenv("COMPANY_PHONE", "0878 188 288")
COMPANY_WORKING_HOURS = os.getenv("COMPANY_WORKING_HOURS", "Пон-Пет 08:30-17:30")

# Speedy shipping: no real API credentials available (docs/issues/speedy-api-shape.md).
# Swap SHIPPING_SPEEDY_CLIENT to a real client's dotted path once they exist.
SHIPPING_SPEEDY_CLIENT = os.getenv(
    "SHIPPING_SPEEDY_CLIENT", "shipping.services.MockSpeedyClient"
)

# VAT: Bulgaria's standard rate is 20% — this is public tax law, not a
# company-specific fact, so it's a safe default (not an invented figure).
# PRICES_INCLUDE_VAT=False matches the legacy site's own convention (prices
# shown "без ДДС" — excl. VAT — with a toggle to add it for display).
# Central config per the client's instruction: never hardcode VAT elsewhere.
VAT_RATE_PERCENT = Decimal(os.getenv("VAT_RATE_PERCENT", "20.00"))
PRICES_INCLUDE_VAT = os.getenv("PRICES_INCLUDE_VAT", "False").lower() in {
    "1",
    "true",
    "yes",
}
SPEEDY_MOCK_FLAT_RATE_BGN = os.getenv("SPEEDY_MOCK_FLAT_RATE_BGN", "6.90")

# Supplier catalog sync (products.management.commands.sync_supplier_catalog).
# Key is embedded in the URL path by the supplier's own API design, not a
# header — never expose this to the frontend (no VITE_ prefix), only read
# it server-side.
SUPPLIER_CATALOG_API_KEY = os.getenv("SUPPLIER_CATALOG_API_KEY", "")
SUPPLIER_CATALOG_BASE_URL = os.getenv(
    "SUPPLIER_CATALOG_BASE_URL", "https://officecenter-bg.com/api/client-integration"
)

KNOWLEDGE_DIR = PROJECT_ROOT / "knowledge"
_httrack_root = (os.getenv("HTTRACK_ROOT") or "").strip()
HTTRACK_ROOT = (
    Path(_httrack_root)
    if _httrack_root
    else (PROJECT_ROOT.parent / "officecenter-bg.com")
)
