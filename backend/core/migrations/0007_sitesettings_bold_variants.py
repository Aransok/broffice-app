from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_sitesettings_paper_design"),
    ]

    operations = [
        migrations.AlterField(
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
                    ("bold", "BRoffice Bold"),
                    ("bold_sky", "BRoffice Bold Sky"),
                    ("bold_sunset", "BRoffice Bold Sunset"),
                    ("bold_mint", "BRoffice Bold Mint"),
                    ("paper", "BRoffice Paper"),
                ],
                default="classic",
                max_length=32,
            ),
        ),
    ]
