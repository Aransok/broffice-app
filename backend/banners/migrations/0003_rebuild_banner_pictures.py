# Banner pictures now fall back to the plain photo when background removal
# makes the product see-through (white products on white backgrounds).
# Clearing subject_paths makes the next sync_banners() rebuild every
# current banner with that check, instead of keeping the ghostly cut-outs.
from django.db import migrations


def clear_pictures(apps, schema_editor):
    apps.get_model("banners", "Banner").objects.update(subject_paths=None)


class Migration(migrations.Migration):

    dependencies = [
        ("banners", "0002_banner_subject_paths"),
    ]

    operations = [
        migrations.RunPython(clear_pictures, migrations.RunPython.noop),
    ]
