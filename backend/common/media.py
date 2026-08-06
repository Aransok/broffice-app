"""Shared resolution of a ProductImage/Category.image_path-style relative
path to a real file on this disk — used anywhere server-side code needs to
actually open image bytes (order emails, banner generation), not just link
to them from the frontend."""

from pathlib import Path

from django.conf import settings


def resolve_media_path(image_path: str) -> Path | None:
    if not image_path:
        return None
    if image_path.startswith(("products/", "categories/", "brands/")):
        candidate = Path(settings.MEDIA_ROOT) / image_path
    elif settings.HTTRACK_ROOT:
        candidate = Path(settings.HTTRACK_ROOT) / image_path.lstrip("/")
    else:
        return None
    return candidate if candidate.exists() and candidate.is_file() else None
