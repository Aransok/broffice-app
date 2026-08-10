import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def developer_user(db, settings):
    settings.DEVELOPER_USERNAMES = ["dev1"]
    return User.objects.create_user(
        username="dev1", password="pass12345", is_staff=True, is_superuser=True
    )


@pytest.fixture
def other_admin_user(db, settings):
    settings.DEVELOPER_USERNAMES = ["dev1"]
    return User.objects.create_user(
        username="client_admin", password="pass12345", is_staff=True, is_superuser=True
    )


@pytest.fixture
def backup_root(tmp_path, settings):
    settings.BACKUP_ROOT = str(tmp_path)
    d = tmp_path / "2026-08-10_0100"
    d.mkdir()
    (d / "database.sql").write_text("-- dump", encoding="utf-8")
    return tmp_path


@pytest.mark.django_db
def test_backup_list_requires_developer(api_client, other_admin_user, backup_root):
    api_client.force_authenticate(user=other_admin_user)
    resp = api_client.get("/api/v1/admin/backups/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_backup_list_requires_auth(api_client, backup_root):
    resp = api_client.get("/api/v1/admin/backups/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_backup_list_returns_real_backups_for_developer(
    api_client, developer_user, backup_root
):
    api_client.force_authenticate(user=developer_user)
    resp = api_client.get("/api/v1/admin/backups/")
    assert resp.status_code == 200
    assert resp.data == [{"name": "2026-08-10_0100", "size_kb": 0, "has_media": False}]


@pytest.mark.django_db
def test_restore_requires_developer(api_client, other_admin_user, backup_root):
    api_client.force_authenticate(user=other_admin_user)
    resp = api_client.post("/api/v1/admin/backups/2026-08-10_0100/restore/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_restore_rejects_unknown_backup(api_client, developer_user, backup_root):
    api_client.force_authenticate(user=developer_user)
    resp = api_client.post("/api/v1/admin/backups/does-not-exist/restore/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_restore_request_then_status_reflects_pending(
    api_client, developer_user, backup_root
):
    api_client.force_authenticate(user=developer_user)
    resp = api_client.post("/api/v1/admin/backups/2026-08-10_0100/restore/")
    assert resp.status_code == 200

    status_resp = api_client.get("/api/v1/admin/backups/status/")
    assert status_resp.status_code == 200
    assert status_resp.data["state"] == "pending"


@pytest.mark.django_db
def test_me_endpoint_exposes_is_developer_correctly(
    api_client, developer_user, other_admin_user
):
    api_client.force_authenticate(user=developer_user)
    resp = api_client.get("/api/v1/me/")
    assert resp.data["is_developer"] is True

    api_client.force_authenticate(user=other_admin_user)
    resp = api_client.get("/api/v1/me/")
    assert resp.data["is_developer"] is False
