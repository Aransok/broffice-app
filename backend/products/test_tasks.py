from unittest.mock import MagicMock, patch

from django.core import mail

from products.tasks import sync_supplier_catalog_task


def test_skips_when_no_api_key(settings, caplog):
    settings.SUPPLIER_CATALOG_API_KEY = ""
    with patch("products.tasks.SyncSupplierCatalogCommand") as mock_command_cls:
        sync_supplier_catalog_task()
    mock_command_cls.assert_not_called()
    assert len(mail.outbox) == 0


def test_success_sends_no_email(settings):
    settings.SUPPLIER_CATALOG_API_KEY = "test-key"
    mock_instance = MagicMock(created_count=3, updated_count=7)
    with patch("products.tasks.SyncSupplierCatalogCommand", return_value=mock_instance):
        sync_supplier_catalog_task()
    mock_instance.handle.assert_called_once()
    assert len(mail.outbox) == 0


def test_failure_emails_admin_and_does_not_raise(settings):
    settings.SUPPLIER_CATALOG_API_KEY = "test-key"
    settings.ADMIN_ORDER_EMAIL = "admin@example.com"
    mock_instance = MagicMock()
    mock_instance.handle.side_effect = RuntimeError("supplier API is down")
    with patch("products.tasks.SyncSupplierCatalogCommand", return_value=mock_instance):
        sync_supplier_catalog_task()  # must not raise
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["admin@example.com"]
    assert "supplier API is down" in mail.outbox[0].body
