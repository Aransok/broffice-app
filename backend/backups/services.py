"""Lists backups made by scripts/backup-database.ps1 and lets a developer
request a restore — without ever performing the restore itself from inside
this running process.

Why the restore doesn't happen here: this code runs inside the same
gunicorn worker that's connected to the very database a restore would
replace. Dropping/reloading a database out from under a live connection to
it is exactly the kind of self-referential operation that goes wrong in
surprising ways — a restore is an ops action performed on a stopped app,
not an in-app feature. Instead, this just writes a plain marker file that
scripts/restore-watcher.ps1 (running on the host, outside any container,
via Windows Task Scheduler) picks up, stops the app containers, performs
the actual restore, restarts them, and writes a status file back — which
this module also reads, to report progress to the UI.
"""

from __future__ import annotations

import os
from pathlib import Path

from django.conf import settings

REQUEST_FILE = "_restore_request.txt"
STATUS_FILE = "_restore_status.txt"


def _backup_root() -> Path:
    return Path(settings.BACKUP_ROOT)


def list_backups() -> list[dict]:
    root = _backup_root()
    if not root.exists():
        return []

    backups = []
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        db_file = entry / "database.sql"
        if not db_file.exists():
            continue
        backups.append(
            {
                "name": entry.name,
                "size_kb": round(db_file.stat().st_size / 1024),
                "has_media": (entry / "media.zip").exists(),
            }
        )
    backups.sort(key=lambda b: b["name"], reverse=True)
    return backups


def request_restore(backup_name: str) -> None:
    # Only ever matches an existing backup name discovered from disk —
    # never constructs a path directly from the input, so nothing here can
    # be a path-traversal vector regardless of what's in backup_name.
    valid_names = {b["name"] for b in list_backups()}
    if backup_name not in valid_names:
        raise ValueError(f"Unknown backup: {backup_name}")

    root = _backup_root()
    (root / REQUEST_FILE).write_text(backup_name, encoding="utf-8")
    status_path = root / STATUS_FILE
    if status_path.exists():
        os.remove(status_path)


def get_restore_status() -> dict:
    root = _backup_root()
    if (root / REQUEST_FILE).exists() and not (root / STATUS_FILE).exists():
        return {
            "state": "pending",
            "message": "Waiting for the restore watcher to pick this up.",
        }

    status_path = root / STATUS_FILE
    if not status_path.exists():
        return {"state": "idle", "message": ""}

    # utf-8-sig strips a leading BOM if present — restore-watcher.ps1 writes
    # this file with PowerShell's Set-Content, which adds one by default.
    # Found by actually running the watcher and checking the real file
    # content: startswith("done:") silently failed against "﻿done:
    # ...", reporting "in_progress" forever after a real successful restore.
    content = status_path.read_text(encoding="utf-8-sig").strip()
    if content.startswith("done:"):
        return {"state": "done", "message": content[len("done:") :].strip()}
    if content.startswith("error:"):
        return {"state": "error", "message": content[len("error:") :].strip()}
    return {"state": "in_progress", "message": content}
