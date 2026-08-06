import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _isolate_media_root(tmp_path, settings):
    # Any test that saves a file (product images, invoice PDFs) must never
    # write into the real project media/ folder — every test gets its own
    # throwaway directory instead.
    settings.MEDIA_ROOT = str(tmp_path)


@pytest.fixture(autouse=True)
def _clear_cache():
    # Django's cache (LocMemCache by default) is process-wide, not reset by
    # the per-test DB transaction rollback pytest-django already gives us —
    # without this, DRF's rate-limit throttles (keyed by IP, which every
    # test client shares) accumulate across unrelated tests and start
    # rejecting requests a test never expected to be throttled.
    cache.clear()
