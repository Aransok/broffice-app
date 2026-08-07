from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from seo import views as seo_views

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
    path("robots.txt", seo_views.robots_txt),
    path("sitemap.xml", seo_views.sitemap_xml),
    path("llms.txt", seo_views.llms_txt),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # Interim bridge only — see docs/issues/product-images-not-copied.md.
    # ProductImage.path still stores original HTTrack-relative paths because the
    # real copy/resize/webp pipeline was never built; this serves those originals
    # directly from the read-only mirror until that pipeline exists.
    urlpatterns += static("/legacy-media/", document_root=settings.HTTRACK_ROOT)
