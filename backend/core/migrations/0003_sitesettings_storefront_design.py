from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_sitesettings_pigeon_express_pickup_office"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="storefront_design",
            field=models.CharField(
                choices=[
                    ("classic", "Clean Business"),
                    ("modern", "Modern Commerce"),
                    ("compact", "Compact Professional"),
                    ("premium", "Premium"),
                    ("soft", "Soft / Friendly"),
                    ("brand", "BRoffice (фирмени цветове)"),
                    ("fresh", "BRoffice 2026"),
                ],
                default="classic",
                max_length=32,
            ),
        ),
    ]
