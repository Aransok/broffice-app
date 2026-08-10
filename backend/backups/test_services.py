import pytest

from backups.services import get_restore_status, list_backups, request_restore


@pytest.fixture
def backup_root(tmp_path, settings):
    settings.BACKUP_ROOT = str(tmp_path)
    return tmp_path


def _make_backup(root, name, with_media=True):
    d = root / name
    d.mkdir()
    (d / "database.sql").write_text("-- fake dump", encoding="utf-8")
    if with_media:
        (d / "media.zip").write_bytes(b"fake zip")
    return d


def test_list_backups_empty_when_root_missing(settings):
    settings.BACKUP_ROOT = "/does/not/exist"
    assert list_backups() == []


def test_list_backups_ignores_incomplete_folders(backup_root):
    _make_backup(backup_root, "2026-08-10_0100")
    (backup_root / "not-a-backup").mkdir()  # no database.sql - must be ignored
    (backup_root / "some-file.txt").write_text("x")  # not a dir - must be ignored

    result = list_backups()
    assert len(result) == 1
    assert result[0]["name"] == "2026-08-10_0100"
    assert result[0]["has_media"] is True


def test_list_backups_sorted_newest_first(backup_root):
    _make_backup(backup_root, "2026-08-08_0100")
    _make_backup(backup_root, "2026-08-10_0100")
    _make_backup(backup_root, "2026-08-09_0100")

    result = list_backups()
    assert [b["name"] for b in result] == [
        "2026-08-10_0100",
        "2026-08-09_0100",
        "2026-08-08_0100",
    ]


def test_request_restore_rejects_unknown_name(backup_root):
    _make_backup(backup_root, "2026-08-10_0100")
    with pytest.raises(ValueError):
        request_restore("../../etc/passwd")
    with pytest.raises(ValueError):
        request_restore("2026-08-11_0100")  # doesn't exist


def test_request_restore_writes_marker_file(backup_root):
    _make_backup(backup_root, "2026-08-10_0100")
    request_restore("2026-08-10_0100")
    assert (backup_root / "_restore_request.txt").read_text(
        encoding="utf-8"
    ) == "2026-08-10_0100"


def test_status_idle_when_nothing_requested(backup_root):
    assert get_restore_status() == {"state": "idle", "message": ""}


def test_status_pending_after_request_before_watcher_picks_up(backup_root):
    _make_backup(backup_root, "2026-08-10_0100")
    request_restore("2026-08-10_0100")
    status = get_restore_status()
    assert status["state"] == "pending"


def test_status_in_progress_reflects_watcher_status_file(backup_root):
    (backup_root / "_restore_status.txt").write_text(
        "stopping app...", encoding="utf-8"
    )
    status = get_restore_status()
    assert status == {"state": "in_progress", "message": "stopping app..."}


def test_status_done_survives_utf8_bom(backup_root):
    # Real bug, found by actually running restore-watcher.ps1: Windows
    # PowerShell's Set-Content -Encoding utf8 writes a BOM by default,
    # which broke startswith("done:") and silently reported "in_progress"
    # forever after a real successful restore.
    (backup_root / "_restore_status.txt").write_bytes(
        b"\xef\xbb\xbf" + b"done: 2026-08-10_0100"
    )
    status = get_restore_status()
    assert status == {"state": "done", "message": "2026-08-10_0100"}


def test_status_done(backup_root):
    (backup_root / "_restore_status.txt").write_text(
        "done: 2026-08-10_0100", encoding="utf-8"
    )
    status = get_restore_status()
    assert status == {"state": "done", "message": "2026-08-10_0100"}


def test_status_error(backup_root):
    (backup_root / "_restore_status.txt").write_text(
        "error: psql exit code 1", encoding="utf-8"
    )
    status = get_restore_status()
    assert status == {"state": "error", "message": "psql exit code 1"}


def test_new_request_clears_old_status(backup_root):
    _make_backup(backup_root, "2026-08-10_0100")
    (backup_root / "_restore_status.txt").write_text(
        "done: some-old-backup", encoding="utf-8"
    )
    request_restore("2026-08-10_0100")
    assert not (backup_root / "_restore_status.txt").exists()
