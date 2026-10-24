from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_sitesettings_bold_design"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="storefront_features",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
