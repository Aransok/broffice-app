"""Image metadata enrichment."""

from __future__ import annotations

import hashlib
from pathlib import Path


class ImageParser:
    def __init__(self, httrack_root: Path):
        self.httrack_root = httrack_root

    def enrich(self, media: dict, referenced_by: str | None = None) -> dict:
        original = (media.get("original_path") or media.get("src") or "").lstrip("./")
        # Normalize HTTrack relative paths like image/product/xxx.jpg
        candidates = [
            self.httrack_root / original,
            self.httrack_root / original.replace("../../", ""),
        ]
        # Also try stripping leading ../ segments
        cleaned = original
        while cleaned.startswith("../"):
            cleaned = cleaned[3:]
        candidates.append(self.httrack_root / cleaned)

        file_path = next((c for c in candidates if c.is_file()), None)
        meta = {
            "original_path": cleaned or original,
            "src": media.get("src"),
            "alt": media.get("alt", ""),
            "sort_order": media.get("sort_order", 0),
            "referenced_by": referenced_by,
            "exists_on_disk": file_path is not None,
            "hash": None,
            "size": None,
            "width": None,
            "height": None,
        }
        if file_path:
            data = file_path.read_bytes()
            meta["hash"] = hashlib.sha256(data).hexdigest()
            meta["size"] = len(data)
            meta["absolute_path"] = str(file_path)
        return meta
